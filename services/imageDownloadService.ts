import * as FileSystem from 'expo-file-system/legacy';
import { withDb } from '../database/database';
import { isPlaceholderImage, nowIso } from '../utils/normalization';
import { IMAGE_DOWNLOAD_CONCURRENCY } from '../utils/constants';
import { getSettingsSnapshot, updateSetting } from './settingsService';

export interface ImageProgress { done:number; total:number; successful:number; failed:number; skipped:number; }
export interface AccountImageRecord { id:number; remote_url:string|null; local_path:string|null; download_status:string; }

function safeUrl(u:string|null){return !!u&&/^https?:\/\//i.test(u)&&!isPlaceholderImage(u);}
function extensionFor(url:string){return (url.match(/\.(jpe?g|png|webp|gif|bmp)(?:[?#]|$)/i)?.[1]||'jpg').toLowerCase();}
function hash(s:string){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return h;}
function fileName(id:number,url:string){return `account_${id}_${Math.abs(hash(url))}.${extensionFor(url)}`;}
function safeFolderName(name:string){const cleaned=name.trim().replace(/[\\/:*?"<>|]/g,'_').replace(/\s+/g,' ').replace(/^\.+|\.+$/g,'').trim();return cleaned||'Unnamed Model';}
function mimeFor(ext:string){return ext==='png'?'image/png':ext==='webp'?'image/webp':ext==='gif'?'image/gif':ext==='bmp'?'image/bmp':'image/jpeg';}
function unique<T>(values:T[]){return Array.from(new Set(values));}

export function isPlaceholder(url:string|null){return isPlaceholderImage(url);}

export async function getAccountImageRecords(accountId:number):Promise<AccountImageRecord[]>{
  return withDb('Failed to load account images',db=>db.getAllAsync<AccountImageRecord>(
    'SELECT id,remote_url,local_path,download_status FROM account_images WHERE account_id=? AND (local_path IS NOT NULL OR remote_url IS NOT NULL) ORDER BY id ASC',[accountId],
  ));
}

export async function downloadImage(accountId:number,url:string|null):Promise<string|null>{
  if(!safeUrl(url))return null;
  const root=FileSystem.documentDirectory;if(!root)return null;
  const dir=`${root}images/accounts/`;
  await FileSystem.makeDirectoryAsync(dir,{intermediates:true});
  const target=dir+fileName(accountId,url!);
  try{
    const info=await FileSystem.getInfoAsync(target);
    const uri=info.exists?target:(await FileSystem.downloadAsync(url!,target)).uri||null;
    if(!uri)return null;
    await withDb('Failed to save downloaded image',async db=>{
      const ts=nowIso();
      await db.runAsync('UPDATE accounts SET local_image_path=?,profile_image_uri=?,updated_at=? WHERE id=?',[uri,uri,ts,accountId]);
      const existing=await db.getFirstAsync<{id:number}>('SELECT id FROM account_images WHERE account_id=? AND remote_url=? LIMIT 1',[accountId,url!]);
      if(existing)await db.runAsync('UPDATE account_images SET local_path=?,download_status=?,downloaded_at=?,updated_at=? WHERE id=?',[uri,'DOWNLOADED',ts,ts,existing.id]);
      else await db.runAsync('INSERT INTO account_images(account_id,remote_url,local_path,is_primary,image_type,download_status,downloaded_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',[accountId,url!,uri,0,'profile','DOWNLOADED',ts,ts,ts]);
    });
    return uri;
  }catch{return null;}
}

export async function downloadAllImages(accountId:number,urls?:string[]):Promise<ImageProgress>{
  const records=await getAccountImageRecords(accountId);
  const candidates=unique((urls??records.map(r=>r.remote_url).filter((u):u is string=>!!u)).filter(u=>safeUrl(u)));
  const p:ImageProgress={done:0,total:candidates.length,successful:0,failed:0,skipped:0};
  let next=0;
  const worker=async()=>{while(true){const i=next++;if(i>=candidates.length)return;const uri=await downloadImage(accountId,candidates[i]);if(uri)p.successful++;else p.failed++;p.done++;}};
  await Promise.all(Array.from({length:Math.min(IMAGE_DOWNLOAD_CONCURRENCY,Math.max(1,candidates.length))},worker));
  return p;
}

async function ensureSelectedDirectory():Promise<string|null>{
  let directoryUri=getSettingsSnapshot().imageSaveDirectoryUri;
  if(directoryUri)return directoryUri;
  const permissions=await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(
    FileSystem.StorageAccessFramework.getUriForDirectoryInRoot('Download'),
  );
  if(!permissions.granted)return null;
  directoryUri=permissions.directoryUri;
  await updateSetting('imageSaveDirectoryUri',directoryUri);
  return directoryUri;
}

async function ensureSubdirectory(parentUri:string,folderName:string):Promise<string>{
  try{return await FileSystem.StorageAccessFramework.makeDirectoryAsync(parentUri,folderName);}
  catch{
    const entries=await FileSystem.StorageAccessFramework.readDirectoryAsync(parentUri);
    const wanted=folderName.toLowerCase();
    const found=entries.find(uri=>{const raw=decodeURIComponent(uri.split('/').pop()||'').toLowerCase();return raw===wanted;});
    if(found)return found;
    throw new Error(`Could not create the folder "${folderName}".`);
  }
}

async function writeLocalFileToSaf(source:string,target:string){
  const base64=await FileSystem.readAsStringAsync(source,{encoding:FileSystem.EncodingType.Base64});
  await FileSystem.writeAsStringAsync(target,base64,{encoding:FileSystem.EncodingType.Base64});
}

export async function saveAllImagesToDeviceStorage(accountId:number,modelName:string|null,onProgress?:(done:number,total:number)=>void):Promise<{saved:number;failed:number;folderUri:string|null}>{
  let records=await getAccountImageRecords(accountId);
  records=records.filter(r=>safeUrl(r.remote_url)||!!r.local_path);
  if(!records.length)return{saved:0,failed:0,folderUri:null};

  const parent=await ensureSelectedDirectory();
  if(!parent)return{saved:0,failed:0,folderUri:null};
  const folder=await ensureSubdirectory(parent,safeFolderName(modelName||'Unnamed Model'));
  const existingNames=new Set((await FileSystem.StorageAccessFramework.readDirectoryAsync(folder)).map(uri=>decodeURIComponent(uri.split('/').pop()||'')));
  let saved=0,failed=0;
  for(let i=0;i<records.length;i++){
    const record=records[i];
    try{
      let source=record.local_path;
      if(!source&&record.remote_url)source=await downloadImage(accountId,record.remote_url);
      if(!source)throw new Error('No local or remote image source');
      const ext=extensionFor(record.remote_url||source);
      const stableName=`image_${String(i+1).padStart(2,'0')}_${Math.abs(hash(record.remote_url||source))}.${ext}`;
      if(!existingNames.has(stableName)){
        const target=await FileSystem.StorageAccessFramework.createFileAsync(folder,stableName,mimeFor(ext));
        await writeLocalFileToSaf(source,target);
        existingNames.add(stableName);
      }
      saved++;
    }catch{failed++;}
    onProgress?.(i+1,records.length);
  }
  return{saved,failed,folderUri:folder};
}

export async function saveImageToDeviceStorage(accountId:number,remoteUrl:string|null,existingLocalPath?:string|null):Promise<string|null>{
  const result=await saveAllImagesToDeviceStorage(accountId,null);
  return result.saved>0?result.folderUri:null;
}

export async function queueImageDownloads(items:{accountId:number;url:string|null}[],onProgress?:(p:ImageProgress)=>void){
  const p:ImageProgress={done:0,total:items.length,successful:0,failed:0,skipped:0};let next=0;
  const worker=async()=>{while(true){const i=next++;if(i>=items.length)return;const item=items[i];if(!safeUrl(item.url)){p.skipped++;p.done++;onProgress?.({...p});continue;}const uri=await downloadImage(item.accountId,item.url);if(uri)p.successful++;else p.failed++;p.done++;onProgress?.({...p});}};
  await Promise.all(Array.from({length:Math.min(IMAGE_DOWNLOAD_CONCURRENCY,Math.max(1,items.length))},worker));return p;
}

export async function saveImageRecord(accountId:number,remoteUrl:string|null,localPath:string|null){
  if(!remoteUrl&&!localPath)return;
  await withDb('Failed to save image',async db=>{const t=nowIso();await db.runAsync('INSERT INTO account_images(account_id,remote_url,local_path,is_primary,image_type,download_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',[accountId,remoteUrl,localPath,0,'profile',localPath?'DOWNLOADED':'NOT_DOWNLOADED',t,t]);});
}
export async function deleteLocalImage(localPath:string|null){if(!localPath)return;try{const info=await FileSystem.getInfoAsync(localPath);if(info.exists)await FileSystem.deleteAsync(localPath,{idempotent:true});}catch{}}
