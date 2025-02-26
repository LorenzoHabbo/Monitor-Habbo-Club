// monitor-groups.js
// Se usi Node <18, assicurati di installare node-fetch e decommenta la riga seguente:
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

// Percorsi per salvare i dati e i report (ora il report accumula lo storico)
const DATA_DIR = path.join(__dirname, 'data');
const REPORTS_DIR = path.join(__dirname, 'reports');

// Crea le cartelle se non esistono
async function ensureDirectories() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(REPORTS_DIR, { recursive: true });
}

// Funzione per confrontare due array di membri
function compareMembers(newMembers, oldMembers) {
  const oldMap = new Map(oldMembers.map(member => [member.uniqueId, member]));
  const newMap = new Map(newMembers.map(member => [member.uniqueId, member]));

  // Nuovi membri: presenti in newMap ma non in oldMap
  const added = newMembers.filter(member => !oldMap.has(member.uniqueId));

  // Abbandoni: presenti in oldMap ma non in newMap
  const removed = oldMembers.filter(member => !newMap.has(member.uniqueId));

  // Cambiamenti in isAdmin per i membri presenti in entrambe
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

// Processa un singolo gruppo: fetch, confronto e salvataggio file e report (in append)
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
      console.error(`Formato dati non valido per il gruppo ${group.name}:`, json);
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
      console.log(`Nessun file dati precedente per il gruppo ${group.name}.`);
    }

    // Confronta i dati
    const report = compareMembers(newData, oldData);

    // Costruisci il contenuto del report da apporre (con separatore per ogni esecuzione)
    let reportContent = `\n====================\n`;
    reportContent += `Report per il gruppo "${group.name}" (${group.id})\n`;
    reportContent += `Data: ${new Date().toLocaleString()}\n\n`;
    reportContent += `Nuovi membri (${report.added.length}):\n`;
    report.added.forEach(member => {
      reportContent += `  - ${member.name} (ID: ${member.uniqueId})\n`;
    });
    reportContent += `\nMembri abbandonati (${report.removed.length}):\n`;
    report.removed.forEach(member => {
      reportContent += `  - ${member.name} (ID: ${member.uniqueId})\n`;
    });
    reportContent += `\nCambiamenti nello stato Admin (${report.adminChanges.length}):\n`;
    report.adminChanges.forEach(change => {
      reportContent += `  - ${change.name} (ID: ${change.uniqueId}): ${change.from} => ${change.to}\n`;
    });
    reportContent += `\nTimestamp: ${new Date().toISOString()}\n`;

    console.log(`Report per ${group.name}:`, reportContent);

    // Salva (in append) il report storico nel file di report (accumulando lo storico)
    const reportFilePath = path.join(REPORTS_DIR, `${group.id}-report.txt`);
    await fs.appendFile(reportFilePath, reportContent, 'utf-8');
    console.log(`Report aggiornato (in append) in: ${reportFilePath}`);

    // Salva i nuovi dati per il confronto futuro (sovrascrivendo il file)
    await fs.writeFile(dataFilePath, JSON.stringify(newData, null, 2), 'utf-8');
    console.log(`Dati aggiornati salvati in: ${dataFilePath}`);
  } catch (error) {
    console.error(`Errore nel processare il gruppo ${group.name}:`, error);
  }
}

// Funzione principale: assicura le directory e processa ogni gruppo
async function main() {
  await ensureDirectories();
  for (const group of groups) {
    await processGroup(group);
  }
}

main();
