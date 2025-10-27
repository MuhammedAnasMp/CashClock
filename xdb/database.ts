// database.ts
import * as SQLite from 'expo-sqlite';
import { User ,Location } from '../types';
let db: SQLite.SQLiteDatabase | null = null;

// Get or open database
 export const getDB = async () => {
  if (!db) {
    db = await SQLite.openDatabaseAsync('myapp.db');
  }
  return db;
};

export const initDatabase = async () => {
  const db = await getDB();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;


    CREATE TABLE IF NOT EXISTS Users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      emp_id TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Locations (
      location_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      location_code TEXT NOT NULL,
      location_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS WorkSessions (
      session_id TEXT PRIMARY KEY NOT NULL,
      emp_id TEXT NOT NULL,
      location_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      tap_in TEXT,
      tap_out TEXT,
      hours_worked REAL,
      outbound_cost REAL,
      return_cost REAL,
      ticket_fare REAL,
      claimed_by INTEGER,
      timesheet_submitted INTEGER DEFAULT 0,
      ticket_fare_claimed INTEGER DEFAULT 0,
      FOREIGN KEY(emp_id) REFERENCES Users(emp_id),
      FOREIGN KEY(location_id) REFERENCES Locations(location_id),
      FOREIGN KEY(claimed_by) REFERENCES Users(user_id)
    );
    
  `);

  console.log('✅ Database initialized');

  // Seed Locations
  const existing = await db.getAllAsync('SELECT * FROM Locations LIMIT 1');
  if (existing.length === 0) {
    const locations = [
      { code: '801', name: 'City 1' },
      { code: '802', name: 'Fahaheel' },
      { code: '809', name: 'Farwaniya 1' },
      { code: '818', name: 'Shuwaikh' },
      { code: '822', name: 'Farwaniya 3' },
      { code: '821', name: 'Hawally 6' },
      { code: '804', name: 'Jaleeb' },
      { code: '806', name: 'Khaitan' },
      { code: '808', name: 'Mahboula 2' },
      { code: '814', name: 'Mangaf' },
      { code: '823', name: 'Mirqab' },
      { code: '811', name: 'Souq Al Kabeer' },
    ];

    const insertQuery = `INSERT INTO Locations (location_code, location_name) VALUES (?, ?)`;
    for (const loc of locations) {
      await db.runAsync(insertQuery, [loc.code, loc.name]);
    }

    console.log('✅ Locations table seeded');
  }
};

export const insertUser = async (empId: string, username: string) => {

  const db = await getDB();
  const result = await db.runAsync(
    'INSERT INTO Users (emp_id, username) VALUES (?, ?)',
    empId,
    username
  );
  console.log('User created:', result.lastInsertRowId);
  return result.lastInsertRowId ?? 0;
};





export const insertLocation = async (location: Location): Promise<number> => {
  const db = await getDB();
  await db.runAsync(
    'INSERT INTO Locations (location_code, location_name) VALUES (?, ?)',
    location.location_id,
    location.location_name
  );
  console.log('Location inserted with custom ID:', location.location_id);
  return location.location_id;
};


// Get all users
export const getUsers = async (): Promise<User[]> => {
  const db = await getDB();
  return await db.getAllAsync<User>('SELECT * FROM Users');
};

// Get all locations
export const getLocations = async (): Promise<Location[]> => {
  const db = await getDB();
  return await db.getAllAsync<Location>('SELECT * FROM Locations');
};

// Update user
export const updateUser = async (user_id: number, emp_id: string, username: string) => {
  const db = await getDB();
  await db.runAsync(
    'UPDATE Users SET emp_id = ?, username = ? WHERE user_id = ?',
    emp_id,
    username,
    user_id
  );
  console.log(`User ${user_id} updated`);
};

// Update location
export const updateLocation = async (location_id: number, location_name: string) => {
  const db = await getDB();
  await db.runAsync(
    'UPDATE Locations SET location_name = ? WHERE location_id = ?',
    location_name,
    location_id
  );
  console.log(`Location ${location_id} updated`);
};

// Delete user
export const deleteUser = async (user_id: number) => {
  const db = await getDB();
  await db.runAsync('DELETE FROM Users WHERE user_id = ?', user_id);
  console.log(`User ${user_id} deleted`);
};

// Delete location
export const deleteLocation = async (location_id: number) => {
  const db = await getDB();
  await db.runAsync('DELETE FROM Locations WHERE location_id = ?', location_id);
  console.log(`Location ${location_id} deleted`);
};


export const getUserByEmpId = async (empId: string) => {
  const db = await getDB();
  const result = await db.getFirstAsync(
    'SELECT * FROM Users WHERE emp_id = ?',
    empId
  );
  return result; // undefined if not found
};




