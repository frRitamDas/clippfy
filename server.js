const express=require('express');const app=require('./api');
const path=require('node:path');
for(const p of ['app','pricing','privacy','terms','refund','admin','editor','reset','status','preview-info'])app.get('/'+p,(req,res)=>res.sendFile(path.join(__dirname,p+'.html')));
app.use('/assets',express.static(path.join(__dirname,'assets')));
app.use('/fonts',express.static(path.join(__dirname,'fonts')));
app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.get('/:page.html',(req,res,next)=>{if(['index','app','pricing','privacy','terms','refund','admin','editor','reset','status','preview-info'].includes(req.params.page))return res.sendFile(path.join(__dirname,req.params.page+'.html'));next();});
app.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Clippfy running on port '+(process.env.PORT||3000)));
