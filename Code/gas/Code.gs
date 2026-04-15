// --- GESTORE RICHIESTE ---
function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  var action = e.parameter.action;
  var result;
  
  try {
    if (action === 'getAziende') result = getAziende();
    else if (action === 'getDipendenti') result = getDipendenti(e.parameter.aziendaId);
    else if (action === 'getAllSlots') result = getAllSlots();
    else if (action === 'addAzienda') result = addAzienda(e.parameter);
    else if (action === 'updateAzienda') result = updateAzienda(e.parameter);
    else if (action === 'deleteAzienda') result = deleteAzienda(e.parameter);
    else if (action === 'addDipendente') result = addDipendente(e.parameter);
    else if (action === 'updateDipendente') result = updateDipendente(e.parameter);
    else if (action === 'deleteDipendente') result = deleteDipendente(e.parameter.aziendaId, e.parameter.id);
    else if (action === 'addSlots') result = addSlots(JSON.parse(e.parameter.slots));
    else if (action === 'updateSlot') result = updateSlot(e.parameter);
    else if (action === 'deleteSlot') result = deleteSlot(e.parameter);
    else throw new Error("Azione '" + action + "' non riconosciuta.");
    
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

// --- LOGICA AZIENDE ---

function addAzienda(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Aziende') || ss.insertSheet('Aziende');
  if (sheet.getLastRow() === 0) sheet.appendRow(['ID', 'Nome', 'Logo', 'Indirizzo', 'ProssimaConvocazione']);
  
  var baseId = data.nome.trim();
  var finalId = baseId;
  var counter = 1;
  var ids = sheet.getDataRange().getValues().map(function(r) { return r[0]; });
  while (ids.indexOf(finalId) !== -1) {
    finalId = baseId + (counter < 10 ? "0" + counter : counter);
    counter++;
  }
  
  sheet.appendRow([finalId, data.nome, data.logo, data.indirizzo, ""]);
  var companySheet = ss.insertSheet(finalId);
  companySheet.appendRow(['ID', 'Nome', 'Mail', 'Sesso']);
  return {success: true, id: finalId};
}

function updateAzienda(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Aziende');
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colId = headers.indexOf('ID');
  
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][colId] == data.id) {
      headers.forEach(function(h, j) {
        if (data[h.toLowerCase()] !== undefined) {
          sheet.getRange(i + 1, j + 1).setValue(data[h.toLowerCase()]);
        } else if (h === 'ProssimaConvocazione' && data.prossimaConvocazione !== undefined) {
          sheet.getRange(i + 1, j + 1).setValue(data.prossimaConvocazione);
        }
      });
      return {success: true};
    }
  }
  return {success: false, error: "Azienda non trovata"};
}

function deleteAzienda(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Aziende');
  var rows = sheet.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] == data.id) {
      sheet.deleteRow(i + 1);
      var companySheet = ss.getSheetByName(data.id);
      if (companySheet) ss.deleteSheet(companySheet);
    }
  }
  return {success: true};
}

function getAziende() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Aziende');
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  var headers = rows.shift();
  return rows.map(function(row) {
    var obj = {}; headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

// --- LOGICA DIPENDENTI ---

function getDipendenti(aziendaId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(aziendaId);
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  var headers = rows.shift();
  return rows.map(function(row) {
    var obj = {}; headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function addDipendente(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(data.aziendaId);
  if (!sheet) throw new Error("Foglio azienda '" + data.aziendaId + "' non trovato.");
  sheet.appendRow([data.id, data.nome, data.email, data.sesso]);
  return {success: true};
}

function updateDipendente(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(data.aziendaId);
  if (!sheet) throw new Error("Foglio azienda non trovato");
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] == data.dipendenteId) {
      sheet.getRange(i + 1, 2).setValue(data.nome);
      sheet.getRange(i + 1, 3).setValue(data.email);
      sheet.getRange(i + 1, 4).setValue(data.sesso);
      return {success: true};
    }
  }
  return {success: false, error: "Dipendente non trovato"};
}

function deleteDipendente(aziendaId, id) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(aziendaId);
  var rows = sheet.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] == id) sheet.deleteRow(i + 1);
  }
  return {success: true};
}

// --- LOGICA DISPONIBILITA ---

function getAllSlots() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Disponibilita') || ss.insertSheet('Disponibilita');
  var tz = ss.getSpreadsheetTimeZone(); 
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Id-Azienda', 'Data', 'Inizio', 'Fine', 'Durata', 'Stato', 'Mail Lavoratore', 'Nome', 'ID_Calendario']);
    return [];
  }
  
  var rows = sheet.getDataRange().getValues();
  var headers = rows.shift();
  return rows.map(function(row) {
    var obj = {}; 
    headers.forEach(function(h, i) { 
      var val = row[i];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, tz, "yyyy-MM-dd");
      }
      obj[h] = val; 
    });
    return obj;
  });
}

// --- CONFIGURAZIONE CALENDARIO ---
const CALENDAR_ID = '5ec48c9ca8e7068ad36446bcc69d00f25f4a76cb08a32fff43f49da8f296dee2@group.calendar.google.com'; 

function updateSlot(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Disponibilita');
  var data = sheet.getDataRange().getValues();
  
  var aziendaId = params.aziendaId;
  var dateStr = params.data; 
  var inizio = params.inizio;
  var nuovoStato = params.stato;
  var mail = params.dipendenteEmail || '';
  var nome = params.dipendenteNome || '';
  
  for (var i = 1; i < data.length; i++) {
    var rowDate = (data[i][1] instanceof Date) ? 
      Utilities.formatDate(data[i][1], ss.getSpreadsheetTimeZone(), "yyyy-MM-dd") : 
      String(data[i][1]).split('T')[0];
    
    if (String(data[i][0]) === aziendaId && rowDate === dateStr && String(data[i][2]) === inizio) {
      sheet.getRange(i + 1, 6).setValue(nuovoStato); // Stato
      sheet.getRange(i + 1, 7).setValue(mail);       // Mail
      sheet.getRange(i + 1, 8).setValue(nome);       // Nome
      
      var eventId = data[i][8]; // Colonna I
      var fine = data[i][3];    
      var aziendaNome = getAziendaNome(aziendaId);
      
      if (nuovoStato === 'Occupato') {
        var newId = syncToCalendar(eventId, nome, aziendaNome, dateStr, inizio, fine, mail);
        sheet.getRange(i + 1, 9).setValue(newId);
      } else if (nuovoStato === 'Libero' && eventId) {
        removeFromCalendar(eventId);
        sheet.getRange(i + 1, 9).setValue('');
      }
      
      return { success: true };
    }
  }
  return { success: false, error: 'Slot non trovato' };
}

function deleteSlot(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Disponibilita');
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    var rowDate = (data[i][1] instanceof Date) ? 
      Utilities.formatDate(data[i][1], ss.getSpreadsheetTimeZone(), "yyyy-MM-dd") : 
      String(data[i][1]).split('T')[0];
    
    if (String(data[i][0]) === params.aziendaId && rowDate === params.data && String(data[i][2]) === params.inizio) {
      var eventId = data[i][8];
      if (eventId) removeFromCalendar(eventId);
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'Slot non trovato' };
}

// --- FUNZIONI DI SUPPORTO ---

function syncToCalendar(eventId, nome, azienda, data, inizio, fine, mail) {
  try {
    var cal = CalendarApp.getCalendarById(CALENDAR_ID);
    if (!cal) {
      Logger.log("ERRORE: Calendario non trovato. Verifica l'ID: " + CALENDAR_ID);
      return eventId || "";
    }

    // Pulizia e formattazione della data (YYYY-MM-DD)
    var datePart = (data instanceof Date) ? 
      Utilities.formatDate(data, Session.getScriptTimeZone(), "yyyy-MM-dd") : 
      String(data).split('T')[0];
    
    // Creazione oggetti data per inizio e fine
    var start = new Date(datePart + 'T' + inizio);
    var end = new Date(datePart + 'T' + fine);
    
    // Controllo se le date sono valide
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      Logger.log("ERRORE: Orario non valido. Inizio: " + inizio + " Fine: " + fine);
      return eventId || "";
    }

    var title = "Visita: " + (nome || "N/A") + " - " + azienda;
    var desc = "Lavoratore: " + (nome || "N/A") + "\nEmail: " + mail + "\nAzienda: " + azienda;

    // Se abbiamo già un ID, proviamo ad aggiornare l'evento esistente
    if (eventId) {
      try {
        var event = cal.getEventById(eventId);
        if (event) {
          event.setTitle(title).setDescription(desc).setTime(start, end);
          Logger.log("Evento aggiornato con successo: " + eventId);
          return eventId;
        }
      } catch (err) {
        Logger.log("Avviso: Evento ID " + eventId + " non trovato, ne creerò uno nuovo.");
      }
    }
    
    // Creazione nuovo evento
    var newEvent = cal.createEvent(title, start, end, {description: desc});
    var newId = newEvent.getId();
    Logger.log("Nuovo evento creato con successo: " + newId);
    return newId;

  } catch (e) {
    Logger.log("ERRORE CRITICO in syncToCalendar: " + e.toString());
    return eventId || ""; 
  }
}

function removeFromCalendar(eventId) {
  try {
    var cal = CalendarApp.getCalendarById(CALENDAR_ID);
    var event = cal.getEventById(eventId);
    if (event) event.deleteEvent();
  } catch (e) { }
}

function getAziendaNome(id) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Aziende');
  if (!sheet) return id;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) return data[i][1];
  }
  return id;
}

function addSlots(slots) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Disponibilita');
  slots.forEach(function(s) {
    // Aggiunge Id-Azienda, Data, Inizio, Fine, Durata, Stato, Mail(vuota), Nome(vuoto), ID_Cal(vuoto)
    sheet.appendRow([s[0], s[1], s[2], s[3], s[4], s[5], "", "", ""]);
  });
  return {success: true};
}

function setupPermissions() {
  try {
    CalendarApp.getCalendarById(CALENDAR_ID);
    SpreadsheetApp.getActiveSpreadsheet();
    Browser.msgBox("Autorizzazione completata con successo!");
  } catch (e) {
    Browser.msgBox("Accetta i permessi nella finestra che apparirà.");
  }
}

function syncAllExistingSlots() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Disponibilita');
  var data = sheet.getDataRange().getValues();
  var count = 0;
  for (var i = 1; i < data.length; i++) {
    var stato = String(data[i][5]);
    var eventId = data[i][8];
    if (stato.toLowerCase() === 'occupato' && !eventId) {
      var dateStr = (data[i][1] instanceof Date) ? 
        Utilities.formatDate(data[i][1], ss.getSpreadsheetTimeZone(), "yyyy-MM-dd") : 
        String(data[i][1]).split('T')[0];
      var newId = syncToCalendar('', data[i][7], getAziendaNome(data[i][0]), dateStr, data[i][2], data[i][3], data[i][6]);
      if (newId) {
        sheet.getRange(i + 1, 9).setValue(newId);
        count++;
      }
    }
  }
  Browser.msgBox("Sincronizzati " + count + " eventi!");
}
