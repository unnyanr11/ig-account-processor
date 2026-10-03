import type{ImportBatch,StatusHistoryEntry}from'../types/history';import{nowIso}from'../utils/normalization';import{withDb}from'./database';import * as FileSystem from 'expo-file-system/legacy';import type{HistoryRepository}from'./interfaces';
export function getUsernameHistory(id:number){return withDb('Failed to load username history',db=>db.getAllAsync<{id:number;account_id:number;old_username:string;new_username:string;import_id:number|null;changed_at:string}>('SELECT * FROM account_username_history WHERE account_id=? ORDER BY id DESC',[id]));}
export function getForAccount(id:number){return withDb('Failed to load history',db=>db.getAllAsync<StatusHistoryEntry>('SELECT * FROM status_history WHERE account_id=? ORDER BY id DESC',[id]));}
export function createImportBatch(fileName:string,totals:any,listId:number|null=null){return withDb('Failed to record import',async db=>{const r=await db.runAsync('INSERT INTO app_imports(source_file_name,source_file_type,source_mime_type,source_size,imported_at,total_records,new_records,updated_records,duplicates,records_without_instagram,records_with_instagram,records_with_images,records_without_images,placeholder_images,warning_count,error_count,list_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[fileName,totals.fileType||'UNKNOWN',totals.mimeType||null,totals.fileSize||null,nowIso(),totals.total,totals.newRecords,totals.updatedRecords||0,totals.duplicates??totals.duplicatesInFile??0,totals.withoutInstagram||0,totals.withInstagram||0,totals.withImages||0,totals.withoutImages||0,totals.placeholderImages||0,totals.warningCount||0,totals.errorCount||totals.invalid||0,listId]);return r.lastInsertRowId;});}
export function linkAccountsToBatch(importId:number,ids:number[]){return withDb('Failed to record import',async db=>{for(const id of ids)await db.runAsync('INSERT OR IGNORE INTO app_import_accounts(import_id,account_id,source_row) VALUES(?,?,NULL)',[importId,id]);});}
export function deleteImportBatch(id:number){return withDb('Failed to remove import record',async db=>{await db.runAsync('DELETE FROM app_imports WHERE id=?',[id]);});}
export function undoImportBatch(id:number){
 return withDb('Failed to undo import',async db=>{
  const files=await db.getAllAsync<{local_image_path:string|null}>('SELECT a.local_image_path FROM accounts a JOIN app_import_accounts ia ON ia.account_id=a.id WHERE ia.import_id=? AND ia.created_by_import=1',[id]);
  const result={restored:0,removed:0,skipped:0};
  await db.withExclusiveTransactionAsync(async txn=>{
   const rows=await txn.getAllAsync<{account_id:number;previous_account_json:string|null;created_by_import:number}>('SELECT account_id,previous_account_json,created_by_import FROM app_import_accounts WHERE import_id=?',[id]);
   const seen=new Set<number>();
   for(const row of rows){
    if(seen.has(row.account_id))continue;
    seen.add(row.account_id);
    if(row.created_by_import){
     const current=await txn.getFirstAsync<{source_import_id:number|null}>('SELECT source_import_id FROM accounts WHERE id=?',[row.account_id]);
     if(current?.source_import_id===id){await txn.runAsync('DELETE FROM accounts WHERE id=?',[row.account_id]);result.removed++;}else result.skipped++;
     continue;
    }
    if(!row.previous_account_json){result.skipped++;continue;}
    const previous=JSON.parse(row.previous_account_json) as Record<string,unknown>;
    const allowed=['username','instagram_url','x_username','x_url','tiktok_username','tiktok_url','identity_key','model_name','letter','display_name','full_name','profile_image_url','image_url','profile_image_uri','local_image_path','source_url','source_file_name','source_file_type','source_mime_type','source_row','source_import_id','raw_data_json','last_processed_at','status','list_id','source','notes','created_at','updated_at'];
    const sets:string[]=[];const params:(string|number|null)[]=[];
    for(const key of allowed){if(Object.prototype.hasOwnProperty.call(previous,key)){sets.push(key+'=?');const v=previous[key];params.push(typeof v==='number'||typeof v==='string'?v as string|number:null);}}
    if(sets.length){params.push(row.account_id);await txn.runAsync('UPDATE accounts SET '+sets.join(',')+' WHERE id=?',params);result.restored++;}
   }
   await txn.runAsync('DELETE FROM account_username_history WHERE import_id=?',[id]);
   await txn.runAsync('DELETE FROM app_imports WHERE id=?',[id]);
  });
  for(const f of files){if(f.local_image_path){try{await FileSystem.deleteAsync(f.local_image_path,{idempotent:true});}catch{}}}
  return result;
 });
}
export function getImportBatches(){return withDb('Failed to load import history',db=>db.getAllAsync<ImportBatch>('SELECT id,source_file_name file_name,source_file_type file_type,source_mime_type mime_type,source_size file_size,list_id,total_records,new_records,updated_records,duplicates duplicate_records,records_without_instagram,records_with_instagram,records_with_images,records_without_images,placeholder_images,warning_count,error_count,imported_at created_at FROM app_imports ORDER BY id DESC'));}
export function getImportBatch(id:number){return withDb('Failed to load import',async db=>(await db.getFirstAsync<ImportBatch>('SELECT id,source_file_name file_name,source_file_type file_type,source_mime_type mime_type,source_size file_size,total_records,new_records,updated_records,duplicates duplicate_records,records_without_instagram,records_with_instagram,records_with_images,records_without_images,placeholder_images,warning_count,error_count,imported_at created_at FROM app_imports WHERE id=?',[id]))??null);}
const _contract:HistoryRepository={getForAccount,getUsernameHistory,createImportBatch,linkAccountsToBatch,deleteImportBatch,undoImportBatch,getImportBatches,getImportBatch};void _contract;