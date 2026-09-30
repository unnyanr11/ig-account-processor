import * as SQLite from 'expo-sqlite';import * as FileSystem from 'expo-file-system/legacy';import AsyncStorage from '@react-native-async-storage/async-storage';
import { DB_NAME } from '../utils/constants';
import { MIGRATIONS, POST_MIGRATIONS } from './schema';
export class DatabaseError extends Error{constructor(message:string,public readonly originalError?:unknown){super(message);this.name='DatabaseError';}}
async function columnExists(db:SQLite.SQLiteDatabase,table:string,column:string){const rows=await db.getAllAsync<{name:string}>(`PRAGMA table_info(${table})`);return rows.some(r=>r.name===column);}
async function migrate(db:SQLite.SQLiteDatabase){const row=await db.getFirstAsync<{user_version:number}>('PRAGMA user_version');let v=row?.user_version??0;
if(v===0){await db.withTransactionAsync(async()=>{for(const s of MIGRATIONS[0])await db.execAsync(s);await db.execAsync('PRAGMA user_version=1');});v=1;}
for(const migration of POST_MIGRATIONS){if(v>=migration.version)continue;await db.withTransactionAsync(async()=>{for(const s of migration.sql){try{if(s.startsWith('ALTER TABLE accounts ADD COLUMN')){const m=s.match(/ADD COLUMN\s+(\w+)/i);if(m&&await columnExists(db,'accounts',m[1]))continue;}await db.execAsync(s);}catch(e){throw new DatabaseError(`Migration ${migration.version} failed`,e);}}await db.execAsync(`PRAGMA user_version=${migration.version}`);});v=migration.version;}}
async function open(){const db=await SQLite.openDatabaseAsync(DB_NAME);await db.execAsync('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');await migrate(db);return db;}
let dbPromise:Promise<SQLite.SQLiteDatabase>|null=null;
export function getDb(){if(!dbPromise)dbPromise=open().catch(e=>{dbPromise=null;throw e;});return dbPromise;}
export async function closeDb(){const p=dbPromise;dbPromise=null;if(p){const db=await p.catch(()=>null);await db?.closeAsync();}}
export async function withDb<T>(message:string,fn:(db:SQLite.SQLiteDatabase)=>Promise<T>):Promise<T>{try{return await fn(await getDb());}catch(e){if(e instanceof DatabaseError)throw e;throw new DatabaseError(message,e);}}
export async function hardResetDatabase(){await withDb('Failed to reset application data',async db=>{await db.withTransactionAsync(async()=>{for(const t of ['app_import_accounts','app_imports','import_batch_accounts','status_history','account_images','list_accounts','accounts','import_batches','lists','settings']){try{await db.runAsync(`DELETE FROM ${t}`);}catch{}}});});try{if(FileSystem.documentDirectory)await FileSystem.deleteAsync(`${FileSystem.documentDirectory}images`,{idempotent:true});}catch{}try{await AsyncStorage.removeItem('app_settings');}catch{}}
