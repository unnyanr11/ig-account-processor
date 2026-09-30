import type{ParsedRow}from'./fileParser';import*as FileSystem from'expo-file-system/legacy';import{isPlaceholderImage}from'../utils/normalization';
const N=['name','fullName','full_name','displayName','display_name','Model Name'];const I=['profilePictureUrl','profileImageUrl','profile_pic_url','profile_image_url','ProfilePicUrl','imageUrl','image','photo'];
const first=(r:ParsedRow,ks:string[])=>{for(const k of ks){const v=r[k];if(typeof v==='string'&&v.trim())return v.trim();}return''};
export interface ProfileMetadata{displayName:string|null;fullName:string|null;imageUrl:string|null;profileImageUri:string|null;}
export function getAccountName(r:ParsedRow){return first(r,N);}
export function getEmbeddedImageUrl(r:ParsedRow){const v=first(r,I);return/^https?:\/\//i.test(v)&&!isPlaceholderImage(v)?v:'';}
export async function fetchProfileMetadata(r:ParsedRow):Promise<ProfileMetadata>{const name=getAccountName(r)||null;const image=getEmbeddedImageUrl(r)||null;return{displayName:name,fullName:name,imageUrl:image,profileImageUri:null};}
export async function cacheImageLocally(url:string,target:string){if(!/^https?:\/\//i.test(url)||isPlaceholderImage(url))return null;try{const dir=target.slice(0,target.lastIndexOf('/')+1);await FileSystem.makeDirectoryAsync(dir,{intermediates:true});const info=await FileSystem.getInfoAsync(target);if(info.exists)return target;const result=await FileSystem.downloadAsync(url,target);return result.uri||null;}catch{return null;}}
