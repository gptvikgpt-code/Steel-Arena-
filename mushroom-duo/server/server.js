import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
const server=createServer((req,res)=>{res.writeHead(200,{'content-type':'text/plain'});res.end('Mushroom Duo server online')});
const wss=new WebSocketServer({server});const rooms=new Map();
const code=()=>String(Math.floor(100000+Math.random()*900000));
wss.on('connection',socket=>{let room=null,id=0;socket.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}
if(m.type==='create'||m.type==='join'){let c=m.type==='create'?code():String(m.code||'');if(!/^\d{6}$/.test(c))return socket.send(JSON.stringify({type:'error',message:'Неверный код'}));if(!rooms.has(c)){if(m.type==='join')return socket.send(JSON.stringify({type:'error',message:'Комната не найдена'}));rooms.set(c,new Set())}const r=rooms.get(c);if(r.size>=2)return socket.send(JSON.stringify({type:'error',message:'Комната заполнена'}));room=c;id=r.size+1;r.add(socket);socket.send(JSON.stringify({type:'room',code:c,playerId:id,players:r.size}));for(const peer of r)if(peer!==socket){peer.send(JSON.stringify({type:'peer',playerId:id}));socket.send(JSON.stringify({type:'peer',playerId:1}))}return}
if(m.type==='state'&&room){for(const peer of rooms.get(room)||[])if(peer!==socket&&peer.readyState===1)peer.send(JSON.stringify({...m,playerId:id}))}
});socket.on('close',()=>{if(room&&rooms.has(room)){const r=rooms.get(room);r.delete(socket);for(const peer of r)if(peer.readyState===1)peer.send(JSON.stringify({type:'peer-left'}));if(!r.size)rooms.delete(room)}})});
const port=process.env.PORT||3000;server.listen(port,'0.0.0.0',()=>console.log('Mushroom Duo listening on '+port));