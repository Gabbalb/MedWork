import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Google Sheets Auth
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '';

  if (!SPREADSHEET_ID) {
    console.warn('WARNING: GOOGLE_SHEET_ID is not set in environment variables.');
  }

  // Helper to get sheet data
  async function getSheetData(range: string) {
    if (!SPREADSHEET_ID) {
      console.error('Cannot fetch sheet data: SPREADSHEET_ID is missing');
      return null;
    }
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range,
      });
      return response.data.values || [];
    } catch (error) {
      console.error(`Error fetching sheet data for ${range}:`, error);
      return null;
    }
  }

  // Helper to cleanup old slots
  const cleanupOldSlots = async () => {
    try {
      if (!SPREADSHEET_ID) return;
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Disponibilita!A2:F',
      });
      const rows = response.data.values;
      if (!rows || rows.length === 0) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const filteredRows = rows.filter(row => {
        if (!row[1]) return false;
        const slotDate = new Date(row[1]);
        slotDate.setHours(0, 0, 0, 0);
        return slotDate >= today;
      });

      if (filteredRows.length !== rows.length) {
        // Clear existing data first
        await sheets.spreadsheets.values.clear({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Disponibilita!A2:F',
        });
        
        if (filteredRows.length > 0) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Disponibilita!A2',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: filteredRows },
          });
        }
        console.log(`Cleaned up ${rows.length - filteredRows.length} old slots.`);
      }
    } catch (error) {
      console.error('Error cleaning up slots:', error);
    }
  };

  // API Routes
  app.post('/api/login', (req, res) => {
    try {
      const { email, password } = req.body;
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPass = process.env.ADMIN_PASSWORD;

      console.log(`Tentativo di login per: ${email}`);
      console.log('Configurazione admin presente:', !!adminEmail, !!adminPass);

      if (email && password && email === adminEmail && password === adminPass) {
        return res.json({ success: true });
      } else {
        return res.status(401).json({ success: false, message: 'Credenziali non valide' });
      }
    } catch (err) {
      console.error('Errore rotta login:', err);
      return res.status(500).json({ success: false, message: 'Errore interno del server' });
    }
  });

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  app.get('/api/aziende', async (req, res) => {
    await cleanupOldSlots();
    const data = await getSheetData('Aziende!A2:D');
    if (!data) return res.status(500).json({ error: 'Failed to fetch companies' });
    
    const aziende = data.map(row => ({
      id: row[0],
      nome: row[1],
      logo: row[2] || '',
      indirizzo: row[3] || '',
    }));
    res.json(aziende);
  });

  app.post('/api/aziende', async (req, res) => {
    const { nome, logo, indirizzo } = req.body;
    const id = `AZ-${Date.now().toString().slice(-6)}`; // Auto-generated ID
    
    try {
      if (!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID is missing');
      
      const values = [[id, nome, logo || '', indirizzo || '']];
      
      // 1. Add company to Aziende sheet
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Aziende!A2:D',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
      });

      // 2. Create a new sheet for this company's employees
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: id,
                  },
                },
              },
            ],
          },
        });

        // 3. Add headers to the new sheet
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${id}!A1:C1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [['Nome', 'Email', 'Sesso']],
          },
        });
      } catch (sheetError) {
        console.error('Error creating company sheet:', sheetError);
        // Continue even if sheet creation fails (might already exist)
      }

      res.json({ success: true, id });
    } catch (error: any) {
      console.error('Detailed Error adding company:', error.response?.data || error.message);
      res.status(500).json({ 
        error: 'Errore nel salvataggio su Google Sheets', 
        details: error.response?.data?.error?.message || error.message 
      });
    }
  });

  app.put('/api/aziende/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, logo, indirizzo } = req.body;
    try {
      if (!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID is missing');
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Aziende!A2:A',
      });
      const ids = response.data.values || [];
      const rowIndex = ids.findIndex(row => row && row[0] && row[0].toString().trim() === id.trim());
      
      if (rowIndex === -1) return res.status(404).json({ error: 'Azienda non trovata' });
      
      const sheetRowIndex = rowIndex + 2;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Aziende!A${sheetRowIndex}:D${sheetRowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[id, nome, logo || '', indirizzo || '']],
        },
      });
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error updating company:', error.message);
      res.status(500).json({ error: 'Errore durante l\'aggiornamento' });
    }
  });

  app.delete('/api/aziende/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`[DELETE] Request to delete company: ${id}`);
    try {
      if (!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID is missing');
      
      // 1. Get Spreadsheet metadata to find sheet IDs
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
      const sheetsList = spreadsheet.data.sheets || [];
      
      const aziendeSheet = sheetsList.find(s => s.properties?.title === 'Aziende');
      const employeeSheet = sheetsList.find(s => s.properties?.title === id);
      const dispSheet = sheetsList.find(s => s.properties?.title === 'Disponibilita');

      if (!aziendeSheet) throw new Error('Foglio "Aziende" non trovato');

      // 2. Find the row index in Aziende sheet
      const aziendeData = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Aziende!A2:A',
      });
      const ids = aziendeData.data.values || [];
      const rowIndex = ids.findIndex(row => row && row[0] && row[0].toString().trim() === id.trim());
      
      const requests: any[] = [];

      // Add request to delete row from Aziende sheet
      if (rowIndex !== -1) {
        const sheetRowIndex = rowIndex + 1; // Row 2 is index 1
        requests.push({
          deleteDimension: {
            range: {
              sheetId: aziendeSheet.properties?.sheetId,
              dimension: 'ROWS',
              startIndex: sheetRowIndex,
              endIndex: sheetRowIndex + 1,
            },
          },
        });
        console.log(`[DELETE] Queueing row deletion at index ${sheetRowIndex} for company ${id}`);
      } else {
        console.warn(`[DELETE] Company ${id} not found in Aziende list. Skipping row deletion.`);
      }

      // Add request to delete the employee sheet
      if (employeeSheet) {
        requests.push({
          deleteSheet: {
            sheetId: employeeSheet.properties?.sheetId,
          },
        });
        console.log(`[DELETE] Queueing sheet deletion for ${id}`);
      } else {
        console.warn(`[DELETE] Employee sheet for ${id} not found. Skipping sheet deletion.`);
      }

      // 3. Execute batch update for row and sheet deletion
      if (requests.length > 0) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: { requests },
        });
        console.log(`[DELETE] Batch update completed for ${id}`);
      }

      // 4. Cleanup availability slots in 'Disponibilita' sheet
      if (dispSheet) {
        const dispResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Disponibilita!A2:F',
        });
        const dispRows = dispResponse.data.values;
        if (dispRows && dispRows.length > 0) {
          const filteredDisp = dispRows.filter(row => row[0] !== id);
          if (filteredDisp.length !== dispRows.length) {
            // Clear the range first
            await sheets.spreadsheets.values.clear({
              spreadsheetId: SPREADSHEET_ID,
              range: 'Disponibilita!A2:F',
            });
            // Rewrite filtered data
            if (filteredDisp.length > 0) {
              await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Disponibilita!A2',
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: filteredDisp },
              });
            }
            console.log(`[DELETE] Cleaned up ${dispRows.length - filteredDisp.length} slots for ${id}`);
          }
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('[DELETE] Error during full deletion:', error.message);
      res.status(500).json({ 
        error: 'Errore durante l\'eliminazione completa dell\'azienda',
        details: error.message 
      });
    }
  });

  app.get('/api/dipendenti/:aziendaId', async (req, res) => {
    const { aziendaId } = req.params;
    try {
      const data = await getSheetData(`${aziendaId}!A2:C`);
      if (!data) return res.json([]);

      const dipendenti = data.map(row => ({
        aziendaId,
        nome: row[0],
        email: row[1],
        sesso: row[2],
      }));
      res.json(dipendenti);
    } catch (error: any) {
      // If sheet doesn't exist, return empty array
      console.warn(`Sheet for company ${aziendaId} might not exist yet.`);
      res.json([]);
    }
  });

  app.post('/api/dipendenti', async (req, res) => {
    const { aziendaId, nome, email, sesso } = req.body;
    try {
      if (!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID is missing');
      
      // We send: Nome, Email, Sesso (to the specific company sheet)
      const values = [[nome, email, sesso || '']];
      
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${aziendaId}!A2:C`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values,
        },
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error adding employee:', error.response?.data || error.message);
      res.status(500).json({ 
        error: 'Errore nel salvataggio del dipendente', 
        details: error.response?.data?.error?.message || error.message 
      });
    }
  });

  app.post('/api/disponibilita', async (req, res) => {
    const { aziendaId, slots } = req.body;
    // slots is an array of [aziendaId, data, oraInizio, oraFine, durata, status]
    try {
      if (!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID is missing');
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Disponibilita!A2',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: slots,
        },
      });
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving availability:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save availability' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    // Standard production (non-Vercel)
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // On Vercel, we don't call listen, Vercel handles the app export
  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  return app;
}

// For Vercel, we export a handler that awaits the app initialization
export default async (req: any, res: any) => {
  const app = await startServer();
  return app(req, res);
};
