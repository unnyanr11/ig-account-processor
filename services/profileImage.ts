import type { ParsedRow } from './fileParser';
import * as FileSystem from 'expo-file-system/legacy';
import { isPlaceholderImage } from '../utils/normalization';

const N = ['name', 'fullName', 'full_name', 'displayName', 'display_name', 'Model Name'];
const I = ['profilePictureUrl', 'profileImageUrl', 'profile_pic_url', 'profile_image_url', 'ProfilePicUrl', 'imageUrl', 'Image URL', 'image', 'photo'];

const first = (r: ParsedRow, keys: string[]) => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
};

export interface ProfileMetadata {
  displayName: string | null;
  fullName: string | null;
  imageUrl: string | null;
  profileImageUri: string | null;
}
export interface ProfileMetadataInput {
  username?: string | null;
  displayName?: string | null;
  fullName?: string | null;
  profileImageUrl?: string | null;
  profileImageUri?: string | null;
}
export function getAccountName(r: ParsedRow): string { return first(r, N); }
export function getEmbeddedImageUrl(r: ParsedRow): string { const v=first(r,I); return /^https?:\/\//i.test(v)&&!isPlaceholderImage(v)?v:''; }
export async function fetchProfileMetadata(input: ProfileMetadataInput): Promise<ProfileMetadata> {
  const displayName=input.displayName?.trim()||input.fullName?.trim()||null;
  const fullName=input.fullName?.trim()||input.displayName?.trim()||null;
  const rawImage=input.profileImageUrl?.trim()||'';
  const imageUrl=rawImage&&/^https?:\/\//i.test(rawImage)&&!isPlaceholderImage(rawImage)?rawImage:null;
  const profileImageUri=input.profileImageUri?.trim()||null;
  return {displayName,fullName,imageUrl,profileImageUri};
}
export async function fetchProfileMetadataFromRow(r: ParsedRow): Promise<ProfileMetadata> {
  const displayName=getAccountName(r)||null;
  const imageUrl=getEmbeddedImageUrl(r)||null;
  return {displayName,fullName:displayName,imageUrl,profileImageUri:null};
}
export async function cacheImageLocally(url:string,target:string){
  if(!/^https?:\/\//i.test(url)||isPlaceholderImage(url))return null;
  try{
    const dir=target.slice(0,target.lastIndexOf('/')+1);
    await FileSystem.makeDirectoryAsync(dir,{intermediates:true});
    const info=await FileSystem.getInfoAsync(target);
    if(info.exists)return target;
    const result=await FileSystem.downloadAsync(url,target);
    return result.uri||null;
  }catch{return null;}
}
