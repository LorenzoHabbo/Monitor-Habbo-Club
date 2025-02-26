// monitor-groups.js
// Se usi Node <18, decommenta la seguente riga:
// const fetch = require('node-fetch');

const fs = require('fs/promises');
const path = require('path');

// Array dei gruppi da monitorare
const groups = [
  { id: "g-hhit-7acf574a748ba61d8630da806f8e5e7b", name: "BLACKPEARL" },
  { id: "g-hhit-be7029dce95f69a40f5e57640c30cc85", name: "Masarez" },
  { id: "g-hhit-c3fe900882ba6ebc01bdc17453b47299", name: "Oblivion" },
  { id: "g-hhit-aae7f46b38f69abbff3d42d86cee0a16", name: "Eternal Warriors" },
  { id: "g-hhit-2b2c13212f5f75731116cbebf7c27f4c", name: "Golden Demons" },
  { id: "g-hhit-cb506cfe44eb2d49894eae2bfc0b7ffb", name: "Hooligans" },
  { id: "g-hhit-f2aa4ed84bfcb4f79942ede9b7dd23bd", name: "Famiglia Corleone" }
];

// Percorsi per salvare i dati e i report (storico in JSON)
const DATA_DIR = path.join(__dirname, 'data');
const REPORTS_DIR = path.join(__dirname, 'reports');

// Crea le cartelle se non esistono
async function ensureDirectories() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(REPORTS_DIR, { recursive: true });
}

// Funzione per confrontare due array di membri e restituire le differenze
function compareMembers(newMembers, oldMembers) {
  const oldMap = new Map(oldMembers.map(member => [member.uniqueId, member]));
  const newMap = new Map(newMembers.map(member => [member.uniqueId, member]));

  const added = newMembers.filter(member => !oldMap.has(member.uniqueId));
  const removed = oldMembers.filter(member => !newMap.has(member.uniqueId));
  const adminChanges = [];
  for (const member of newMembers) {
    if (oldMap.has(member.uniqueId)) {
      const oldMember = oldMap.get(member.uniqueId);
      if (oldMember.isAdmin !== member.isAdmin) {
        adminChanges.push({
          uniqueId: member.uniqueId,
          name: member.name,
          from: oldMember.isAdmin,
          to: member.isAdmin
        });
      }
    }
  }
  return { added, removed, adminChanges };
}

// Formatta una data in italiano
function formatDateItalian(date) {
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'full', timeStyle: 'short' }).format(date);
}

// Processa un singolo gruppo: fetch, confronto e aggiornamento dei file
async function processGroup(group) {
  console.log(`Elaborazione gruppo: ${group.name}`);
  const apiURL = `https://www.habbo.it/api/public/groups/${group.id}/members`;

  try {
    const response = await fetch(apiURL);
    const json = await response.json();
    console.log(`Risposta API per ${group.name}:`, json);

    let newData;
    if (Array.isArray(json)) {
      newData = json;
    } else if (Array.isArray(json.members)) {
      newData = json.members;
    } else {
      console.error(`Formato dati non valido per ${group.name}:`, json);
      return;
    }

    // Ordina i membri: admin per primi
    newData.sort((a, b) => (b.isAdmin === true ? 1 : 0) - (a.isAdmin === true ? 1 : 0));
    console.log(`Dati ottenuti per ${group.name}:`, newData);

    // Legge i dati salvati in precedenza (se esistono)
    const dataFilePath = path.join(DATA_DIR, `${group.id}.json`);
    let oldData = [];
    try {
      const oldFile = await fs.readFile(dataFilePath, 'utf-8');
      oldData = JSON.parse(oldFile);
    } catch (err) {
      console.log(`Nessun file dati precedente per ${group.name}.`);
    }

    // Confronta i dati
    const differences = compareMembers(newData, oldData);

    // Crea l'entry del log con data formattata in italiano
    const now = new Date();
    const logEntry = {
      data: formatDateItalian(now),
      nuovi: differences.added.map(member => ({ name: member.name, uniqueId: member.uniqueId })),
      abbandonati: differences.removed.map(member => ({ name: member.name, uniqueId: member.uniqueId })),
      adminChanges: differences.adminChanges.map(change => ({
        name: change.name,
        uniqueId: change.uniqueId,
        da: change.from,
        a: change.to
      }))
    };
    console.log(`Log entry per ${group.name}:`, logEntry);

    // Aggiorna il file di log JSON: se esiste, carica l'array e aggiungi la nuova entry; altrimenti, creane uno nuovo
    const reportFilePath = path.join(REPORTS_DIR, `${group.id}-report.json`);
    let logArray = [];
    try {
      const existing = await fs.readFile(reportFilePath, 'utf-8');
      logArray = JSON.parse(existing);
      if (!Array.isArray(logArray)) logArray = [];
    } catch (err) {
      console.log(`Nessun file log precedente per ${group.name}, ne verrà creato uno nuovo.`);
    }
    logArray.push(logEntry);
    await fs.writeFile(reportFilePath, JSON.stringify(logArray, null, 2), 'utf-8');
    console.log(`Log aggiornato in: ${reportFilePath}`);

    // Salva i nuovi dati per il confronto futuro
    await fs.writeFile(dataFilePath, JSON.stringify(newData, null, 2), 'utf-8');
    console.log(`Dati aggiornati salvati in: ${dataFilePath}`);

  } catch (error) {
    console.error(`Errore nel processare il gruppo ${group.name}:`, error);
  }
}

// Funzione principale
async function main() {
  await ensureDirectories();
  for (const group of groups) {
    await processGroup(group);
  }
}

main();
