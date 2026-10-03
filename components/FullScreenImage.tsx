import React,{useCallback,useEffect,useRef,useState}from'react';
import{Dimensions,FlatList,Image,Modal,Pressable,StyleSheet,Text,View}from'react-native';
import{accountRepository}from'../database';

interface Props{uri:string|null|undefined;size:number;textColor:string;label?:string;accountId?:number|null;}
const WIDTH=Dimensions.get('window').width;
export default function FullScreenImage({uri,size,textColor,label='Profile picture',accountId}:Props){
 const[visible,setVisible]=useState(false),[zoomed,setZoomed]=useState(false),[images,setImages]=useState<string[]>(uri?[uri]:[]),[index,setIndex]=useState(0);
 const listRef=useRef<FlatList<string>>(null);
 const open=useCallback(async()=>{
   setZoomed(false);setVisible(true);
   if(!accountId)return;
   try{
     const rows=await accountRepository.getImageRecords(accountId);
     const byRemote=new Map<string,string>();
     const standalone=new Set<string>();
     for(const row of rows){
       const remote=row.remote_url?.trim()||'';
       const local=row.local_path?.trim()||'';
       if(remote){
         const key=remote.toLowerCase();
         const existing=byRemote.get(key);
         if(!existing || (!existing.startsWith('file:') && local)) byRemote.set(key,local||remote);
       } else if(local) standalone.add(local);
     }
     const all=[...byRemote.values(),...standalone];
     const unique=Array.from(new Set(all));
     if(uri){
       const uriKey=uri.trim().toLowerCase();
       if(!unique.some(x=>x.trim().toLowerCase()===uriKey)) unique.unshift(uri);
     }
     setImages(unique);setIndex(0);
   }catch{if(uri)setImages([uri]);}
 },[accountId,uri]);
 useEffect(()=>{setImages(uri?[uri]:[]);setIndex(0);setZoomed(false);},[accountId,uri]);
 if(!uri)return null;
 return <>
  <Pressable onPress={(event)=>{event.stopPropagation();void open();}} accessibilityRole='imagebutton' accessibilityLabel={'View '+label+' full screen'}>
   <Image source={{uri}} style={{width:size,height:size,borderRadius:size/2}}/>
  </Pressable>
  <Modal visible={visible} transparent animationType='fade' onRequestClose={()=>setVisible(false)}>
   <View style={styles.backdrop}>
    <Pressable style={styles.close} onPress={()=>setVisible(false)} accessibilityRole='button' accessibilityLabel='Close image'><Text style={styles.closeText}>×</Text></Pressable>
    <FlatList ref={listRef} data={images} horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyExtractor={(item,i)=>item+'-'+i} initialNumToRender={1} windowSize={3} onMomentumScrollEnd={e=>setIndex(Math.round(e.nativeEvent.contentOffset.x/WIDTH))} renderItem={({item})=>
      <Pressable style={styles.page} onPress={()=>setZoomed(v=>!v)} accessibilityRole='button' accessibilityLabel={zoomed?'Return image to fit':'Zoom image'}>
       <Image source={{uri:item}} resizeMode='contain' style={[styles.fullImage,zoomed?styles.zoomed:null]}/>
      </Pressable>
    }/>
    {images.length>1?<Text style={styles.counter}>{index+1} / {images.length}</Text>:null}
    <Text style={[styles.hint,{color:textColor}]}>{images.length>1?'Swipe left or right • ':''}{zoomed?'Tap image to fit':'Tap image to zoom'}</Text>
   </View>
  </Modal>
 </>;
}
const styles=StyleSheet.create({backdrop:{flex:1,backgroundColor:'rgba(0,0,0,0.96)',alignItems:'center',justifyContent:'center'},page:{width:WIDTH,height:'78%',alignItems:'center',justifyContent:'center'},fullImage:{width:'100%',height:'100%'},zoomed:{width:'145%',height:'145%'},close:{position:'absolute',top:48,right:20,width:48,height:48,borderRadius:24,backgroundColor:'rgba(255,255,255,0.16)',alignItems:'center',justifyContent:'center',zIndex:2},closeText:{color:'#fff',fontSize:34,lineHeight:38,fontWeight:'300'},counter:{position:'absolute',top:58,left:20,color:'#fff',fontSize:14,fontWeight:'700'},hint:{position:'absolute',bottom:32,fontSize:13,opacity:0.8}});
