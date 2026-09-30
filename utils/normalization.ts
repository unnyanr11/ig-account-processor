import { IGNORED_IG_PATH_SEGMENTS, PLACEHOLDER_IMAGE_URLS } from './constants';
const NULLISH=new Set(['','n/a','na','null','none','-','—']);
export function nullableText(value:unknown):string|null{if(value===null||value===undefined)return null;const s=String(value).trim();return NULLISH.has(s.toLowerCase())?null:s;}
export function normalizeUsername(raw:string):string{let v=raw.trim();const m=v.match(/(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/(?:_u\/)?([^/?#&\s]+)/i);if(m?.[1])v=m[1];return v.replace(/^@+/,'').replace(/[/?#].*$/,'').trim().toLowerCase();}
export function extractInstagramUsername(value:string|null):string|null{if(!value)return null;const u=normalizeUsername(value);return IGNORED_IG_PATH_SEGMENTS.includes(u)?null:u;}
export function buildInstagramUrl(username:string):string{return `https://www.instagram.com/${encodeURIComponent(username)}/`;}
export function sourceUrlFromNotes(notes:string|null):string|null{if(!notes)return null;const m=notes.match(/https?:\/\/\S+/i);return m?m[0].replace(/[),.;]+$/,''):null;}
export function isPlaceholderImage(url:string|null):boolean{return !!url&&PLACEHOLDER_IMAGE_URLS.includes(url.trim().toLowerCase());}
export function nowIso():string{return new Date().toISOString();}
export function formatDateHuman(iso:string):string{const d=new Date(iso);return Number.isNaN(d.getTime())?iso:d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});}
export function formatDateTimeHuman(iso:string):string{const d=new Date(iso);return Number.isNaN(d.getTime())?iso:`${formatDateHuman(iso)} ${d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true})}`;}
