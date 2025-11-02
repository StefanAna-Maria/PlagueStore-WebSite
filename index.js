const express = require("express"); //biblioteci
const fs = require('fs'); 
const path=require('path');
const sharp=require('sharp');
const sass=require('sass');
const ejs=require('ejs');

const AccesBD= require("./module_proprii/accesbd.js");

const formidable=require("formidable");
const {Utilizator}=require("./module_proprii/utilizator.js")
const session=require('express-session');
const Drepturi = require("./module_proprii/drepturi.js");
//conecatre postgres

const QRCode= require('qrcode');
const puppeteer=require('puppeteer');
const helmet=require('helmet');
const xmljs=require('xml-js');
const { MongoClient } = require("mongodb");

const Client = require('pg').Client;

var client= new Client({database:"bijuterii",
        user:"ana1",
        password:"parola",
        host:"localhost",
        port:5432});
client.connect();

/*client.query("select * from prajituri", function(err, rez){
    console.log(rez);
})*/

client.query("select * from enum_range(null::branduri_bijuterie)", function(err, rez){
    console.log(rez);
})

obGlobal = {
    obErori:null,
    obImagini:null,
    folderCss:path.join(__dirname,"resurse/css"),
    folderScss:path.join(__dirname,"resurse/scss"),
    folderBackup:path.join(__dirname,"backup"),
    optiuniMeniu:[],
    protocol:"http://",
    numeDomeniu:"localhost:8081",
    clientMongo:null,
    bdMongo:null
}

const uri = "mongodb://localhost:27017";
obGlobal.clientMongo = new MongoClient(uri);
obGlobal.bdMongo = obGlobal.clientMongo.db('Tehnici_web');//!!

async function afisFacturi(){
    const facturi = obGlobal.bdMongo.collection('facturi');
    const query = { username: 'prof67195' };
    const factura = await facturi.findOne(query);
    console.log("Factura:",factura);
}
afisFacturi()


client.query("select * from unnest(enum_range(null::tipuri_bijuterii))", function(err, rezCategorie){
    if (err){
        console.log(err);
    }
    else{
        obGlobal.optiuniMeniu=rezCategorie.rows;
    }
});


vect_foldere = ["temp", "temp1", "backup", "poze_uploadate"]
for (let folder of vect_foldere){
    let caleFolder=path.join(__dirname, folder)
    if(!fs.existsSync(caleFolder)){
        fs.mkdirSync(caleFolder);
    }
}   

app = express(); //apelarea unei functii din biblioteca express //tip constructor //returneaza un ob tip server
console.log("Folder proiect", __dirname);
console.log("Cale fisier", __filename);
console.log("Director de lucru", process.cwd()); //cwd current working directory - folderul de unde rulam aplicatia // dirname -folderul aplicatiei 
//console.log - va afisa in consola folderul curent  


app.use(session({ // aici se creeaza proprietatea session a requestului (pot folosi req.session)
    secret: 'abcdefg',//folosit de express session pentru criptarea id-ului de sesiune
    resave: true,
    saveUninitialized: false
  })); ///LAB 11

//nu pot pune aceasta secventa de cod inainte de "app.use(session)" deoarece abia acolo se creeaza cererea de session (ar da crash)
app.use("/*",function(req, res, next){
    res.locals.optiuniMeniu=obGlobal.optiuniMeniu;
    res.locals.Drepturi=Drepturi;
    if (req.session.utilizator){
        req.utilizator=res.locals.utilizator=new Utilizator(req.session.utilizator);
    }
    next();
})

//ceva prank de la diana
app.get("/galerie-pagina", function (req, res) {
    res.render("pagini/galerie-pagina", { imagini: obGlobal.obImagini.imagini });
})

app.set("view engine", "ejs"); //vom lucra cu template ejs

app.use("/resurse", express.static(__dirname + "/resurse")); //primeste o cerere "/resurse", va trimite fisierele /resurse

app.use("/poze_uploadate", express.static(__dirname + "/poze_uploadate"));

app.use("/node_modules", express.static(__dirname + "/node_modules"));
      
// --------------------------utilizatori online ------------------------------------------


function getIp(req){//pentru Heroku/Render
    var ip = req.headers["x-forwarded-for"];//ip-ul userului pentru care este forwardat mesajul
    if (ip){
        let vect=ip.split(",");
        return vect[vect.length-1];
    }
    else if (req.ip){
        return req.ip;
    }
    else{
     return req.connection.remoteAddress;
    }
}


app.all("/*",function(req,res,next){
    let ipReq=getIp(req);
    if (ipReq){ 
        var id_utiliz=req?.session?.utilizator?.id;
        //id_utiliz=id_utiliz?id_utiliz:null;
        //console.log("id_utiliz", id_utiliz);
        // TO DO comanda insert (folosind AccesBD) cu  ip, user_id, pagina(url  din request)
        var obiectCerere;
        if(id_utiliz){
            obiectCerere={
                ip:ipReq,
                user_id:id_utiliz, 
                pagina:req.url
            }
        }
        else{
            obiectCerere={
                ip: ipReq,
                pagina: req.url
            }
        }
        AccesBD.getInstanta().insert(
            {
                tabel:"accesari",
                campuri: obiectCerere
            }, function(err, rez){
                if (err){
                    console.log(err)
                }
            })

    }
    next(); 
});



function stergeAccesariVechi(){
    AccesBD.getInstanta().delete({
        tabel:"accesari",
        conditiiAnd:["now() - data_accesare >= interval '10 minutes' "]}, 
        function(err, rez){
            console.log(err);
        })
}
stergeAccesariVechi();
setInterval(stergeAccesariVechi, 10*60*1000);


async function obtineUtilizatoriOnline(){
    try{
        var rez = await client.query("select username, nume, prenume from utilizatori where id in (select distinct user_id from accesari where now()-data_accesare <= interval '5 minutes')");
            console.log(rez.rows);
            return rez.rows
        } catch (err) {
            console.error(err);
            return []
        }
}


//app.get("/", function(req, res){
//    res.sendFile(__dirname+"/index.html")
//})


//de la tepi
app.get(function(req, res, next){
    client.query("select from unnest(enum_range(null:branduri_bijuterie))", function (err, rezOptiuni){
        res.locals.optiuniMeniu=rezOptiuni.rows
        next();
    })
})
//de la tepi ^^

//--------------------------------------locatie---------------------------------------
async function obtineLocatie() {
    try {
        const response = await fetch('https://secure.geobytes.com/GetCityDetails?key=7c756203dbb38590a66e01a5a3e1ad96&fqcn=109.99.96.15');
        const obiectLocatie = await response.json();
        console.log(obiectLocatie);
        locatie=obiectLocatie.geobytescountry+" "+obiectLocatie.geobytesregion
        return locatie
    } catch(error) {
        console.error(error);
    }
}


function genereazaEvenimente(){
    var evenimente=[]
    var texteEvenimente=["Eveniment important", "Festivitate", "Prajituri gratis", "Zi cu soare", "Aniversare"];
    var dataCurenta=new Date();
    for(i=0;i<texteEvenimente.length;i++){
        evenimente.push({
            data: new Date(dataCurenta.getFullYear(), dataCurenta.getMonth(), Math.ceil(Math.random()*27) ), 
            text:texteEvenimente[i]
        });
    }
    return evenimente;
}

app.get(["/","/home","/index"], async function(req, res){
    //res.sendFile(__dirname+"/index.html")
    res.render("pagini/index", 
        {ip: req.ip,
         imagini:obGlobal.obImagini.imagini,
         useriOnline: await obtineUtilizatoriOnline(),
         locatie:await obtineLocatie(),
         evenimente: genereazaEvenimente()
        }); 
})
//pana aici 


//seturi
app.get("/seturi", function(req, res) {
    client.query(`
      SELECT s.id, s.nume_set, s.descriere_set, array_agg(p.nume) as produse, array_agg(p.pret) as preturi, array_agg(p.id) as produs_ids
      FROM seturi s
      JOIN asociere_set a ON s.id = a.id_set
      JOIN bijuterii p ON a.id_produs = p.id
      GROUP BY s.id
  `, function(err, result) {
        if (err) {
            console.log(err);
            afisareEroare(res, 2);
        } else {
            let seturi = result.rows.map(set => {
                let pret_total = set.preturi.reduce((total, pret) => total + parseFloat(pret), 0);
                let n = set.preturi.length;
                let reducere = Math.min(5, n) * 5;
                let pret_final = pret_total * (1 - reducere / 100);
                return {
                    ...set,
                    pret_total,
                    pret_final
                };
            });
            res.render("pagini/seturi", {
                seturi
            });
        }
    });
});

app.get("/seturi", function(req, res) {
    client.query(`
      SELECT s.id, s.nume_set, s.descriere_set, 
             array_agg(p.nume) AS produse, 
             array_agg(p.pret) AS preturi, 
             array_agg(p.id) AS produs_ids
      FROM seturi s
      JOIN asociere_set a ON s.id = a.id_set
      JOIN bijuterii p ON a.id_produs = p.id
      GROUP BY s.id, s.nume_set, s.descriere_set
  `, function(err, result) {
        if (err) {
            console.log(err);
            afisareEroare(res, 2);
        } else {
            let seturi = result.rows.map(set => {
                let pret_total = set.preturi.reduce((total, pret) => total + parseFloat(pret), 0);
                let n = set.preturi.length;
                let reducere = Math.min(5, n) * 5;
                let pret_final = pret_total * (1 - reducere / 100);
                return {
                    ...set,
                    pret_total,
                    pret_final
                };
            });
            res.render("pagini/seturi", {
                seturi
            });
        }
    });
});

//trimiterea unui mesaj fix
app.get("/cerere", function (req, res) {
    res.send("<b>Hello <b><span syle='color:red'>world!</span>!");
})
//localhost:8080/cerere

//trimiterea unui mesaj dinamic
app.get("/data", function(req, res, next){
    res.write("Data: ");
    next();
});
app.get("/data", function(req, res){
    res.write(""+new Date());
    res.end();

});

//trimterea unui mesaj dinamic in functie de parametri ce fac si ordinea app.get-urilor
app.get("/suma/:a/:b", function (req, res) {
    var suma = parseInt(req.params.a) + parseInt(req.params.b)
    //parseInt conversia la int, fara el se concateneaza
    //req face cererea
    //params parammetru 
    //.a alege parametrul din params 
    res.send("" + suma);
});
//localhost:8080/suma/10/23 
/*
trimiterea unui mesaj dinamic in functie de parametri (req.params; req.query)
ce face /* si ordinea app.get-urilor.
*/
/*app.get("/suma/:a/:b", function(req, res){
    var suma=parseInt(req.params.a)+parseInt(req.params.b)
    res.send(""+suma);

});*/

//galerie animata n shit
app.get("*/galerie-animata.css",function(req, res){

    var sirScss=fs.readFileSync(path.join(__dirname,"resurse/scss_ejs/galerie_animata.scss")).toString("utf8");
    var culori=["navy","black","purple","grey"];
    var indiceAleator=Math.floor(Math.random()*culori.length);
    var culoareAleatoare=culori[indiceAleator]; 
    rezScss=ejs.render(sirScss,{culoare:culoareAleatoare});
    console.log(rezScss);
    var caleScss=path.join(__dirname,"temp/galerie_animata.scss")
    fs.writeFileSync(caleScss,rezScss);
    try {
        rezCompilare=sass.compile(caleScss,{sourceMap:true});
        
        var caleCss=path.join(__dirname,"temp/galerie_animata.css");
        fs.writeFileSync(caleCss,rezCompilare.css);
        res.setHeader("Content-Type","text/css");
        res.sendFile(caleCss);
    }
    catch (err){
        console.log(err);
        res.send("Eroare");
    }
});

app.get("*/galerie-animata.css.map",function(req, res){
    res.sendFile(path.join(__dirname,"temp/galerie-animata.css.map"));
});


app.get("/favicon.ico", function(req, res){
    res.sendFile(path.join(__dirname,"resurse/imagini/ico/favicon.ico"));
    
});

//---------------------------------------------------------PRODUSE:
app.get("/produse", function(req, res){

    console.log(req.query)
    var conditieQuery="";
    if (req.query.tip){
        conditieQuery=` where tip_produs='${req.query.tip}'`
    }
    client.query("select * from unnest(enum_range(null::branduri_bijuterie))", function(err, rezOptiuni){
        client.query("select * from bijuterii", function(err, rez){
            if(err){
                console.log(err);
                afisareEroare(res, 2);
            }
            else{
                res.render("pagini/produse", {produse: rez.rows, optiuni: rezOptiuni.rows} )
            }
        
        })
    });//-nou lab 8
})
app.get("/produs/:id", function(req, res){
    client.query(`select * from bijuterii where id=${req.params.id}`, function(err, rez){
        if (err){
            console.log(err);
            afisareEroare(res, 2);
        }
        else{
            res.render("pagini/produs", {prod: rez.rows[0]})
        }
    })
})//-nou lab 8


// ---------------------------------  cos virtual --------------------------------------

app.use(["/produse_cos","/cumpara"],express.json({limit:'2mb'}));//obligatoriu de setat pt request body de tip json



app.post("/produse_cos",function(req, res){
    console.log(req.body);
    if(req.body.ids_prod.length!=0){
        //TO DO : cerere catre AccesBD astfel incat query-ul sa fie `select nume, descriere, pret, gramaj, imagine from prajituri where id in (lista de id-uri)`
        //de modificat campuri
        AccesBD.getInstanta().select({tabel:"bijuterii", campuri:"nume,descriere,pret, nr_bucati, tip_produs, brand, materiale, gravura_custom, imagine".split(","),conditiiAnd:[`id in (${req.body.ids_prod})`]},
        function(err, rez){
            if(err)
                res.send([]);
            else
                res.send(rez.rows); 
        });
}
    else{
        res.send([]);
    }
 
});


cale_qr=__dirname+"/resurse/imagini/qrcode";
if (fs.existsSync(cale_qr))
  fs.rmSync(cale_qr, {force:true, recursive:true});
fs.mkdirSync(cale_qr);
client.query("select id from bijuterii", function(err, rez){
    for(let prod of rez.rows){
        let cale_prod=obGlobal.protocol+obGlobal.numeDomeniu+"/produs/"+prod.id;
        //console.log(cale_prod);
        QRCode.toFile(cale_qr+"/"+prod.id+".png",cale_prod);
    }
});




async function genereazaPdf(stringHTML,numeFis, callback) {
    const chrome = await puppeteer.launch();
    const document = await chrome.newPage();
    console.log("inainte load")
    //await document.setContent(stringHTML, {waitUntil:"load"});
    await document.setContent(stringHTML, {waitUntil:"load"});
    
    console.log("dupa load")
    await document.pdf({path: numeFis, format: 'A4'});
    
    console.log("dupa pdf")
    await chrome.close();
    
    console.log("dupa inchidere")
    if(callback)
        callback(numeFis);
}

app.post("/cumpara",function(req, res){
    console.log(req.body);

    if (req?.utilizator?.areDreptul?.(Drepturi.cumparareProduse)){
        AccesBD.getInstanta().select({
            tabel:"bijuterii",
            campuri:["*"],
            conditiiAnd:[`id in (${req.body.ids_prod})`]
        }, function(err, rez){
            if(!err  && rez.rowCount>0){
                console.log("produse:", rez.rows);
                let rezFactura= ejs.render(fs.readFileSync("./views/pagini/factura.ejs").toString("utf-8"),{
                    protocol: obGlobal.protocol, 
                    domeniu: obGlobal.numeDomeniu,
                    utilizator: req.session.utilizator,
                    produse: rez.rows
                });
                console.log(rezFactura);
                let numeFis=`./temp/factura${(new Date()).getTime()}.pdf`;
                genereazaPdf(rezFactura, numeFis, function (numeFis){
                    mesajText=`Stimate ${req.session.utilizator.username} aveti mai jos factura.`;
                    mesajHTML=`<h2>Stimate ${req.session.utilizator.username},</h2> aveti mai jos factura.`;
                    req.utilizator.trimiteMail("Factura", mesajText,mesajHTML,[{
                        filename:"factura.pdf",
                        content: fs.readFileSync(numeFis)
                    }] );
                    res.send("Totul e bine!");
                });
                insereazaFactura(req,rez)
            }
        })
    }
    else{
        res.send("Nu puteti cumpara daca nu sunteti logat sau nu aveti dreptul!");
    }
    
});

// ---------------------------        factura          -----------------------------
async function genereazaPdf(stringHTML, numeFis, callback) {
    const chrome = await puppeteer.launch();
    const document = await chrome.newPage();
    console.log("inainte load")
    //await document.setContent(stringHTML, {waitUntil:"load"});
    await document.setContent(stringHTML, { waitUntil: "load" });//generam o noua pagina

    console.log("dupa load")
    await document.pdf({ path: numeFis, format: 'A4' });//calea cu care generam pdf ul

    console.log("dupa pdf")
    await chrome.close();

    console.log("dupa inchidere")
    if (callback)
        callback(numeFis);
}

function insereazaFactura(req, rezultatRanduri) {
    rezultatRanduri.rows.forEach(function (elem) { elem.cantitate = 1 });//1 se schimba cu cantitatea
    let jsonFactura = {
        data: new Date(),
        username: req.session.utilizator.username,
        produse: rezultatRanduri.rows
    }
    console.log("JSON factura", jsonFactura)
    if (obGlobal.bdMongo) {
        obGlobal.bdMongo.collection("facturi").insertOne(jsonFactura, function (err, rezmongo) {
            if (err) console.log(err)
            else console.log("Am inserat factura in mongodb");

            obGlobal.bdMongo.collection("facturi").find({}).toArray(//ca sa gasim anumite facturi
                function (err, rezInserare) {
                    if (err) console.log(err)
                    else console.log(rezInserare);
                })
        })
    }
}

/*---------------------------------------UTILIZATORI------------------------------------------*/

app.post("/inregistrare",function(req, res){
    var username;
    var poza;
    var formular= new formidable.IncomingForm()
    formular.parse(req, function(err, campuriText, campuriFisier ){//4
        console.log("Inregistrare:",campuriText);


        console.log(campuriFisier);
        console.log(poza, username);
        var eroare="";


        // TO DO var utilizNou = creare utilizator
        var utilizNou = new Utilizator();
        try{
            utilizNou.setareNume=campuriText.nume[0];
            utilizNou.setareUsername=campuriText.username[0];
            utilizNou.email=campuriText.email[0]
            utilizNou.prenume=campuriText.prenume[0]
           
            utilizNou.parola=campuriText.parola[0];
            utilizNou.culoare_chat=campuriText.culoare_chat[0];
            utilizNou.poza= poza[0];
            Utilizator.getUtilizDupaUsername(campuriText.username[0], {}, function(u, parametru ,eroareUser ){
                if (eroareUser==-1){//nu exista username-ul in BD
                    //TO DO salveaza utilizator
                    utilizNou.salvareUtilizator();
                }
                else{
                    eroare+="Mai exista username-ul";
                }


                if(!eroare){
                    res.render("pagini/inregistrare", {raspuns:"Inregistrare cu succes!"})
                   
                }
                else
                    res.render("pagini/inregistrare", {err: "Eroare: "+eroare});
            })
           


        }
        catch(e){
            console.log(e);
            eroare+= "Eroare site; reveniti mai tarziu";
            console.log(eroare);
            res.render("pagini/inregistrare", {err: "Eroare: "+eroare})
        }
   

    });
    formular.on("field", function(nume,val){  // 1
   
        console.log(`--- ${nume}=${val}`);
       
        if(nume=="username")
            username=val;
    })
    formular.on("fileBegin", function(nume,fisier){ //2
        console.log("fileBegin");
       
        console.log(nume,fisier);
        //TO DO adaugam folderul poze_uploadate ca static si sa fie creat de aplicatie
        //TO DO in folderul poze_uploadate facem folder cu numele utilizatorului (variabila folderUser)
        var folderUser = path.join(__dirname, "poze_uploadate", username)
        if(!fs.existsSync(folderUser))
            fs.mkdirSync(folderUser);
       
        fisier.filepath=path.join(folderUser, fisier.originalFilename)
        poza=fisier.originalFilename;
        //fisier.filepath=folderUser+"/"+fisier.originalFilename
        console.log("fileBegin:",poza)
        console.log("fileBegin, fisier:",fisier)


    })    
    formular.on("file", function(nume,fisier){//3
        console.log("file");
        console.log(nume,fisier);
    });
});

//Lab 12 - aici am ramas
app.post("/login",function(req, res){
    /*TO DO 
        parametriCallback: cu proprietatile: request(req), response(res) si parola
        testam daca parola trimisa e cea din baza de date
        testam daca a confirmat mailul
        Tot este done!
    */
    var username;
    console.log("ceva");
    var formular= new formidable.IncomingForm()
    

    formular.parse(req, function(err, campuriText, campuriFisier ){
        var parametriCallback = {
            req:req,
            res:res,
            parola: campuriText.parola[0]
        }
        Utilizator.getUtilizDupaUsername (campuriText.username[0],parametriCallback, 
            function(u, obparam, eroare ){
                let parolaCriptata = Utilizator.criptareParola(obparam.parola)
            if(u.parola == parolaCriptata && u.confirmat_mail){ 
                u.poza=u.poza?path.join("poze_uploadate",u.username, u.poza):"";
                obparam.req.session.utilizator=u;
                //problema pt meet 
                obparam.req.session.mesajLogin="Bravo! Te-ai logat!";
                obparam.res.redirect("/index");
            }
            else{
                console.log("Eroare logare")
                obparam.req.session.mesajLogin="Date logare incorecte sau nu a fost confirmat mailul!";
                obparam.res.redirect("/index");
            }
        })
    });
    
});



app.get("/logout", function(req, res){
    req.session.destroy();
    res.locals.utilizator=null;
    res.render("pagini/logout");
});

//add 10June
//http://${Utilizator.numeDomeniu}/cod/${utiliz.username}/${token}
app.get("/cod/:username/:token",function(req,res){
    /*TO DO parametriCallback: cu proprietatile: request (req) si token (luat din parametrii cererii)
        setat parametriCerere pentru a verifica daca tokenul corespunde userului
    */
    console.log(req.params);

    try {
        var parametriCallback={
            req:req,
            token:req.params.token
        }
        Utilizator.getUtilizDupaUsername(req.params.username,parametriCallback ,function(u,obparam){
            let parametriCerere={
                tabel:"utilizatori",
                campuri:{confirmat_mail:true},
                conditiiAnd:[`id=${u.id}`]
            };
            AccesBD.getInstanta().update(
                parametriCerere, 
                function (err, rezUpdate){
                    if(err || rezUpdate.rowCount==0){
                        console.log("Cod:", err);
                        afisareEroare(res,3);
                    }
                    else{
                        res.render("pagini/confirmare.ejs");
                    }
                })
        })
    }
    catch (e){
        console.log(e);
        afisareEroare(res,2);
    }
})

//dupa logout
app.post("/profil", function(req, res){
    console.log("profil");
    if (!req.session.utilizator){
        afisareEroare(res,403)
        //res.render("pagini/eroare_generala",{text:"Nu sunteti logat."});
        return;
    }
    var formular= new formidable.IncomingForm();
 
    formular.parse(req,function(err, campuriText, campuriFile){
       
        var parolaCriptata=Utilizator.criptareParola(campuriText.parola[0]);
 
        AccesBD.getInstanta().updateParametrizat(
            {tabel:"utilizatori",
            campuri:["nume","prenume","email","culoare_chat"],
            valori:[
                `${campuriText.nume[0]}`,
                `${campuriText.prenume[0]}`,
                `${campuriText.email[0]}`,
                `${campuriText.culoare_chat[0]}`],
            conditiiAnd:[
                `parola='${parolaCriptata}'`,
                `username='${campuriText.username[0]}'`
            ]
        },
                 
        function(err, rez){
            if(err){
                console.log(err);
                afisareEroare(res,2);
                return;
            }
            console.log(rez.rowCount);
            if (rez.rowCount==0){
                res.render("pagini/profil",{mesaj:"Update-ul nu s-a realizat. Verificati parola introdusa."});
                return;
            }
            else{            
                //actualizare sesiune
                console.log("ceva");
                req.session.utilizator.nume= campuriText.nume[0];
                req.session.utilizator.prenume= campuriText.prenume[0];
                req.session.utilizator.email= campuriText.email[0];
                req.session.utilizator.culoare_chat= campuriText.culoare_chat[0];
                res.locals.utilizator=req.session.utilizator;
            }
 
 
            res.render("pagini/profil",{mesaj:"Update-ul s-a realizat cu succes."});
 
        });
       
 
    });
});

app.get("/useri", function(req, res){
    /* TO DO
    * in if testam daca utilizatorul din sesiune are dreptul sa vizualizeze utilizatori
    * completam obiectComanda cu parametrii comenzii select pentru a prelua toti utilizatorii
    */
    if(req?.utilizator?.areDreptul(Drepturi.vizualizareUtilizatori)){
        var obiectComanda={
            tabel:"utilizatori",
            campuri:["*"],
            conditiiAnd:[]
        };
        AccesBD.getInstanta().select(obiectComanda, function(err, rezQuery){
            console.log(err);
            res.render("pagini/useri", {useri: rezQuery.rows});
        });
        
    }
    else{
        afisareEroare(res, 403);
    }
    
});



// async function f(){
//     console.log(1);
//     return 100;
// }


// rez = await f();



app.post("/sterge_utiliz",  function(req, res){

    /* TO DO
    * in if testam daca utilizatorul din sesiune are dreptul sa stearga utilizatori
    * completam obiectComanda cu parametrii comenzii select pentru a prelua toti utilizatorii
    */
    if(req?.utilizator?.areDreptul(Drepturi.stergereUtilizatori)){
        var formular= new formidable.IncomingForm();
 
        formular.parse(req,function(err, campuriText, campuriFile){
                var obiectComanda= {
                    tabel:"utilizatori",
                    conditiiAnd:[`id=${campuriText.id_utiliz[0]}`]
                }
                AccesBD.getInstanta().delete(obiectComanda, function(err, rezQuery){
                console.log(err);
                res.redirect("/useri");
            });
        });
    }else{
        afisareEroare(res,403);
    }
    
})

///////////////////////////////////////////
//////////////// Contact//////////////////
app.use(["/contact"], express.urlencoded({extended:true}));

caleXMLMesaje="resurse/xml/contact.xml";
headerXML=`<?xml version="1.0" encoding="utf-8"?>`;
function creeazaXMlContactDacaNuExista(){
    if (!fs.existsSync(caleXMLMesaje)){
        let initXML={
            "declaration":{
                "attributes":{
                    "version": "1.0",
                    "encoding": "utf-8"
                }
            },
            "elements": [
                {
                    "type": "element",
                    "name":"contact",
                    "elements": [
                        {
                            "type": "element",
                            "name":"mesaje",
                            "elements":[]                            
                        }
                    ]
                }
            ]
        }
        let sirXml=xmljs.js2xml(initXML,{compact:false, spaces:4});//obtin sirul xml (cu taguri)
        console.log(sirXml);
        fs.writeFileSync(caleXMLMesaje,sirXml);
        return false; //l-a creat
    }
    return true; //nu l-a creat acum
}


function parseazaMesaje(){
    let existaInainte=creeazaXMlContactDacaNuExista();
    let mesajeXml=[];
    let obJson;
    if (existaInainte){
        let sirXML=fs.readFileSync(caleXMLMesaje, 'utf8');
        obJson=xmljs.xml2js(sirXML,{compact:false, spaces:4});
        

        let elementMesaje=obJson.elements[0].elements.find(function(el){
                return el.name=="mesaje"
            });
        let vectElementeMesaj=elementMesaje.elements?elementMesaje.elements:[];// conditie ? val_true: val_false
        console.log("Mesaje: ",obJson.elements[0].elements.find(function(el){
            return el.name=="mesaje"
        }))
        let mesajeXml=vectElementeMesaj.filter(function(el){return el.name=="mesaj"});
        return [obJson, elementMesaje,mesajeXml];
    }
    return [obJson,[],[]];
}


app.get("/contact", function(req, res){
    let obJson, elementMesaje, mesajeXml;
    [obJson, elementMesaje, mesajeXml] =parseazaMesaje();

    res.render("pagini/contact",{ utilizator:req.session.utilizator, mesaje:mesajeXml})
});

app.post("/contact", function(req, res){
    let obJson, elementMesaje, mesajeXml;
    [obJson, elementMesaje, mesajeXml] =parseazaMesaje();
        
    let u= req.session.utilizator?req.session.utilizator.username:"anonim";
    let mesajNou={
        type:"element", 
        name:"mesaj", 
        attributes:{
            username:u, 
            data:new Date()
        },
        elements:[{type:"text", "text":req.body.mesaj}]
    };
    if(elementMesaje.elements)
        elementMesaje.elements.push(mesajNou);
    else 
        elementMesaje.elements=[mesajNou];
    console.log(elementMesaje.elements);
    let sirXml=xmljs.js2xml(obJson,{compact:false, spaces:4});
    console.log("XML: ",sirXml);
    fs.writeFileSync("resurse/xml/contact.xml",sirXml);
    
    res.render("pagini/contact",{ utilizator:req.session.utilizator, mesaje:elementMesaje.elements})
});
///////////////////////////////////////////////////////

app.get("/favicon.ico", function(req,res){
    res.sendFile(path.join(__dirname, "resurse/imagini/ico/favicon.ico"))
});

app.get(new RegExp("^\/[a-z0-9A-Z\/]*\/$"), function(req, res){
    afisareEroare(res,403);
});

app.get("/*.ejs", function (req, res) {
    afisareEroare(res,400);
});

app.get("/*", function (req, res) {
    console.log(req.url)
    try{
        res.render("pagini" + req.url, function(err, rezHtml){
            //res.send(rezHtml);
            console.log("Eroare: " + err)
            if(err){
                if(err.message.startsWith("Failed to lookup view")){
                    afisareEroare(res, 404);
                    console.log("Nu a gasit pagina: ", req.url)
                }
            }
            else{
                res.send(rezHtml+"");
            }

        });
    }
    catch(err1){
        if(err1){
            if(err1.message.startsWith("Cannot find module")){
                afisareEroare(res, 404);
                console.log("Nu a gasit resursa: ", req.url)
            }
        }
        else{
            afisareEroare(res)
            console.log("Eroare: "+err1)
        }
    }
})


function initErori(){
    var continut = fs.readFileSync(path.join(__dirname,"resurse/json/erori.json")).toString("utf-8")
    console.log(continut);

    obGlobal.obErori = JSON.parse(continut)
    for(let eroare of obGlobal.obErori.info_erori){
        eroare.imagine=path.join(obGlobal.obErori.cale_baza,eroare.imagine)
    }
    /*console.log(obGlobal.obErori)
    obGlobal.obErori.eroare_default.imagine=path.join(obGlobal.obErori.cale_baza,obGlobal.obErori.eroare_default.imagine)*/
/*}*/
obGlobal.obErori.eroare_default=path.join(obGlobal.obErori.cale_baza,obGlobal.obErori.eroare_default.imagine)
    console.log(obGlobal.obErori);

}
initErori()

function afisareEroare(res, _identificator, _titlu, _text, _imagine){
        let eroare = obGlobal.obErori.info_erori.find(

            function(elem){
                return elem.identificator == _identificator
            }
        )
        if(!eroare){
            let eroare_default=obGlobal.obErori.eroare_default
            res.render("pagini/eroare", {
                titlu: _titlu || eroare_default.titlu,
                text: _text || eroare_default.text,
                imagine: _imagine || eroare_default.imagine,
            })
        }
        else{
            if(eroare.status)
                res.status(eroare.identificator)
            res.render("pagini/eroare", {
                titlu: _titlu || eroare.titlu,
                text: _text || eroare.text,
                imagine: _imagine || eroare.imagine,
        })
        return;
    }
}

initErori()
//cursul urm toata tratarea erorilor

function initImagini(){
    var continut= fs.readFileSync(path.join(__dirname, "/resurse/json/galerie.json")).toString("utf-8");

    obGlobal.obImagini=JSON.parse(continut);
    let vImagini=obGlobal.obImagini.imagini;

    let caleAbs=path.join(__dirname,obGlobal.obImagini.cale_galerie);
    let caleAbsMediu=path.join(__dirname,obGlobal.obImagini.cale_galerie, "mediu");
    if (!fs.existsSync(caleAbsMediu))
        fs.mkdirSync(caleAbsMediu);

    //for (let i=0; i< vErori.length; i++ ) 
    for (let imag of vImagini){
        [numeFis, ext]=imag.fisier.split(".");
        let caleFisAbs=path.join(caleAbs,imag.fisier);
        let caleFisMediuAbs=path.join(caleAbsMediu, numeFis+".webp");
        sharp(caleFisAbs).resize(300).toFile(caleFisMediuAbs);    //toFile inseamna unde salveaza fisierul nou, iar resize primeste width ul si imi redimensioneaza     automat si height ul pt ca se pastreaza aspect ratio
        imag.fisier_mediu=path.join("/", obGlobal.obImagini.cale_galerie, "mediu",numeFis+".webp" )
        imag.fisier=path.join("/", obGlobal.obImagini.cale_galerie, imag.fisier )
        
    }

}
initImagini();


function compileazaScss(caleScss, caleCss) {
    // console.log("cale:", caleCss);
    if (!caleCss) {
        let numeFisExt = path.basename(caleScss);
        let numeFis = numeFisExt.split(".")[0]; /// "a.scss"  -> ["a","scss"]
        caleCss = numeFis + ".css";
    }

    if (!path.isAbsolute(caleScss))
        caleScss = path.join(obGlobal.folderScss, caleScss);
    if (!path.isAbsolute(caleCss))
        caleCss = path.join(obGlobal.folderCss, caleCss);

    let caleBackup = path.join(obGlobal.folderBackup, "resurse/css");
    if (!fs.existsSync(caleBackup)) {
        fs.mkdirSync(caleBackup, { recursive: true });
    }

    // la acest punct avem cai absolute in caleScss si  caleCss
    //TO DO
    let numeFisCss = path.basename(caleCss);
    let numeFisCssBackup = numeFisCss.split(".")[0];
    if (fs.existsSync(caleCss)) {
        fs.copyFileSync(
            caleCss,
            path.join(
                caleBackup,
                numeFisCssBackup +
                    "_" +
                    new Date().getTime() +
                    "." +
                    numeFisCss.split(".")[1]
            )
        );
    }
    rez = sass.compile(caleScss, { sourceMap: true });
    fs.writeFileSync(caleCss, rez.css);
    //console.log("Compilare SCSS",rez);
}




//compileazaScss("a.scss");
vFisiere = fs.readdirSync(obGlobal.folderScss);
for (let numeFis of vFisiere) {
    if (path.extname(numeFis) == ".scss") {
        compileazaScss(numeFis);
        // setInterval();
        stergeFisiereBackup();     //apelez bonus 13(sergere backup)
    }
}


function stergeFisiereBackup() {
    let caleBackup = path.join(obGlobal.folderBackup, "resurse/css");
    fs.readdir(caleBackup, function (err, files) {
        if (err) {
            console.error(
                "Nu s-au sters fisierele vechi din backup!",
                err
            );
        } else {
            files.forEach(function (file, index) {
                var fisierDeSters = path.join(caleBackup, file);
                fs.stat(fisierDeSters, function (error, stat) {
                    if (error) {
                        console.error(
                            "Nu s-au citit date despre fisier!",
                            error
                        );
                        return;
                    }
                    var numarDeMinuteTrecute =
                        (new Date() - stat.birthtime) / (1000 * 60);
                    if (numarDeMinuteTrecute >= 30) {
                        fs.unlink(fisierDeSters, function (deleteError) {
                            if (deleteError && deleteError.code == "ENOENT") {
                                console.info("Fisierul nu exista!");
                            } else if (deleteError) {
                                console.error(
                                    "A aparut o eroare la stergerea fisierului!"
                                );
                            } else {
                                console.info("Fisier sters!");
                            }
                        });
                    }
                });
            });
        }
    });
}

setInterval(stergeFisiereBackup, 60 * 1000);


fs.watch(obGlobal.folderScss, function (eveniment, numeFis) {
    console.log(eveniment, numeFis);
    if (eveniment == "change" || eveniment == "rename") {
        let caleCompleta = path.join(obGlobal.folderScss, numeFis);
        if (fs.existsSync(caleCompleta)) {
            compileazaScss(caleCompleta);
        }
    }
});


app.listen(8081); //port // unde se face cererea
console.log("Serverul a pornit!");
