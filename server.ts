import _http from "http";
import _https from "https";
import _url from "url";
import _fs from "fs";
import _express from "express";
import _dotenv from "dotenv";
import _cors from "cors";
import _fileUpload from "express-fileupload";
import _cloudinary, { UploadApiResponse } from 'cloudinary';
import _streamifier from "streamifier";
import _axios from "axios";
const _nodemailer = require("nodemailer");
import _jwt from "jsonwebtoken";
import _bcrypt from "bcryptjs"; // + @types
// import { google } from "googleapis";

// Lettura delle password e parametri fondamentali
_dotenv.config({ "path": ".env" });

// Configurazione Cloudinary
_cloudinary.v2.config({
    cloud_name: process.env.cloud_name,
    api_key: process.env.api_key,
    api_secret: process.env.api_secret
});

// Variabili relative a MongoDB ed Express
import { MongoClient, ObjectId } from "mongodb";
const DBNAME = process.env.DBNAME;
const connectionString: string = process.env.connectionStringAtlas;
const app = _express();



// Creazione ed avvio del server https, a questo server occorre passare le chiavi RSA (pubblica e privata)
// app è il router di Express, si occupa di tutta la gestione delle richieste https
const PORT: number = parseInt(process.env.PORT);
let paginaErrore;
const PRIVATE_KEY = _fs.readFileSync("./keys/privateKey.pem", "utf8");
const CERTIFICATE = _fs.readFileSync("./keys/certificate.crt", "utf8");
const CREDENTIALS = { "key": PRIVATE_KEY, "cert": CERTIFICATE };
const http_server = _http.createServer(app);
const ENCRYPTION_KEY = _fs.readFileSync("./keys/encryptionKey.txt", "utf8")
// Il secondo parametro facoltativo ipAddress consente di mettere il server in ascolto su una delle interfacce della macchina, se non lo metto viene messo in ascolto su tutte le interfacce (3 --> loopback e 2 di rete)
http_server.listen(PORT, () => {
    init();
    console.log(`Server HTTP in ascolto sulla porta ${PORT}`);
});

function init() {
    _fs.readFile("./static/error.html", function (err, data) {
        if (err) {
            paginaErrore = `<h1>Risorsa non trovata</h1>`;
        }
        else {
            paginaErrore = data.toString();
        }
    });
}

const EMAIL = process.env.email;

//********************************************************************************************//
// Routes middleware
//********************************************************************************************//

// 1. Request log
app.use("/", (req: any, res: any, next: any) => {
    console.log(`-----> ${req.method}: ${req.originalUrl}`);
    next();
});

// 2. Gestione delle risorse statiche

app.use("/", _express.static("./static"));

// 3. Lettura dei parametri POST di req["body"] (bodyParser)

app.use("/", _express.json({ "limit": "50mb" }));

app.use("/", _express.urlencoded({ "limit": "50mb", "extended": true }));

// 4. Aggancio dei parametri del FormData e dei parametri scalari passati dentro il FormData

app.use("/", _fileUpload({ "limits": { "fileSize": (10 * 1024 * 1024) } }));

// 5. Log dei parametri GET, POST, PUT, PATCH, DELETE
app.use("/", (req: any, res: any, next: any) => {
    if (Object.keys(req["query"]).length > 0) {
        console.log(`       ${JSON.stringify(req["query"])}`);
    }
    if (Object.keys(req["body"]).length > 0) {
        console.log(`       ${JSON.stringify(req["body"])}`);
    }
    next();
});

// 6. Controllo degli accessi tramite CORS
// Procedura che lascia passare tutto, accetta tutte le richieste

const corsOptions = {
    origin: function (origin, callback) {
        return callback(null, true);
    },
    credentials: true
};
app.use("/", _cors(corsOptions));

// Procedura che utilizza la whitelist, accetta solo le richieste presenti nella whitelist
/*const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) // browser direct call
            return callback(null, true);
        if (whitelist.indexOf(origin) === -1) {
            var msg = `The CORS policy for this site does not allow access from the specified Origin.`
            return callback(new Error(msg), false);
        }
        else
            return callback(null, true);
    },
    credentials: true
};
app.use("/", _cors(corsOptions));*/

// 7. Configurazione di nodemailer con utilizzo di credenziali locali
/*const auth = {
    "user": process.env.gmailUser,
    "pass": process.env.gmailPassword,
}
const transporter = _nodemailer.createTransport({
    "service": "gmail",
    "auth": auth
});
let message = _fs.readFileSync("./message.html", "utf8");*/

// 7. Configurazione di nodemailer con utilizzo di oAuth2
/* const o_Auth2 = JSON.parse(process.env.oAuthCredential as any)
const OAuth2 = google.auth.OAuth2; // Oggetto OAuth2
const OAuth2Client = new OAuth2(
    o_Auth2["client_id"],
    o_Auth2["client_secret"]
);
OAuth2Client.setCredentials({
    refresh_token: o_Auth2.refresh_token,
}); */

let message = _fs.readFileSync("./message.html", "utf8");
//8. login

app.post("/api/login", async (req, res, next) => {
    let username = req["body"]["username"]
    let password = req["body"]["password"]
    const client = new MongoClient(connectionString)
    await client.connect()
    const collection = client.db(DBNAME).collection("utenti")
    let regex = new RegExp(username, "i")
    let request = collection.findOne({ "username": regex }, { "projection": { "username": 1, "password": 1 } })
    request.then((dbUser) => {
        if (!dbUser) {
            res.status(401).send("Username not valid")
        }
        else if (dbUser.username != "admin") {
            res.status(401).send("User not authorized")
        }
        else {
            console.log("Password: " + password + " dbUser.password: " + dbUser.password)
            _bcrypt.compare(password, dbUser.password, (err, success) => {
                if (err)
                    res.status(500).send("Bcrypt compare error " + err.message)
                else {
                    if (!success) {
                        res.status(401).send("Password not valid")
                    }
                    else {
                        let token = creaToken(dbUser);
                        console.log(token)
                        res.setHeader("authorization", token)
                        res.setHeader("access-control-expose-headers", "authorization")
                        res.send({ "ris": "ok" })
                    }
                }
            })
        }
    })
    request.catch((err) => {
        res.status(500).send("Query fallita")
    })
    request.finally(() => {
        client.close()
    })
})

function creaToken(data) {
    let currentTime = Math.floor(new Date().getTime() / 1000)
    let payload = {
        "_id": data._id,
        "username": data.username,
        "iat": data.iat || currentTime,
        "exp": currentTime + parseInt(process.env.durata_token)
    }
    let token = _jwt.sign(payload, ENCRYPTION_KEY)
    return token
}

//9. controllo token Google
app.post("/api/googleLogin", async (req, res, next) => {
    if (!req.headers["authorization"]) {
        res.status(403).send("Token mancante")
    }
    else {
        let token = req.headers["authorization"]
        //ottengo payload del token con decodifica Base64
        let payload = _jwt.decode(token);
        let username = payload["email"]
        const client = new MongoClient(connectionString)
        await client.connect()
        const collection = client.db(DBNAME).collection("utenti")
        let regex = new RegExp("^" + username + "$", "i")
        let request = collection.findOne({ "username": regex }, { "projection": { "username": 1 } })
        request.then((dbUser) => {
            if (!dbUser) {
                res.status(403).send("Username non autorizzato")
            }
            else {
                let token = creaToken(dbUser);
                //console.log(token)
                res.setHeader("authorization", token)
                res.setHeader("access-control-expose-headers", "authorization")
                res.send({ "ris": "ok" })
            }
        })
        request.catch((err) => {
            res.status(500).send("Query fallita")
        })
        request.finally(() => {
            client.close()
        })
    }
})

//10. controllo token
app.use("/api/", (req, res, next) => {
    if (!req["body"]["skipCheckToken"]) {
        if (!req.headers["authorization"]) {
            res.status(403).send("Token mancante")
        }
        else {
            let token = req["headers"]["authorization"]
            _jwt.verify(token, ENCRYPTION_KEY, (err, payload) => {
                if (err) {
                    res.status(403).send("Token corrotto " + err)
                }
                else {
                    let newToken = creaToken(payload)
                    console.log(newToken)
                    res.setHeader("authorization", newToken)
                    res.setHeader("access-control-expose-headers", "authorization")
                    req["payload"] = payload
                    next()
                }
            })
        }
    }
    else {

        next()
    }

})

//********************************************************************************************//
// Routes finali di risposta al client
//********************************************************************************************//

app.get("/api/getUtenti", async (req, res, next) => {
    const client = new MongoClient(connectionString)
    await client.connect()
    const collection = client.db(DBNAME).collection("utenti")
    let request = collection.find({ "username": { "$ne": "admin" } }).toArray()
    request.then((data) => {
        res.send(data)
    })
    request.catch((err) => {
        res.status(500).send("Query fallita")
    })
    request.finally(() => {
        client.close()
    })
})

app.get("/api/getUtenteByCodice", async (req, res, next) => {
    let codice = req["query"]["codice"]
    const client = new MongoClient(connectionString)
    await client.connect()
    const collection = client.db(DBNAME).collection("utenti")
    let request = collection.findOne({ "codice": parseInt(codice) })
    request.then((data) => {
        console.log(data)
        res.send(data)
    })
    request.catch((err) => {
        res.status(500).send("Query fallita")
    })
    request.finally(() => {
        client.close()
    })
});

app.get("/api/getPerizie", async (req, res, next) => {
    let utente = req["query"]["utente"]
    let request
    console.log(utente)
    const client = new MongoClient(connectionString)
    const collection = client.db(DBNAME).collection("perizie")
    await client.connect()
    if (utente == "Tutti")
        request = collection.find().toArray()
    else
        request = collection.find({ "rilevatore": parseInt(utente) }).toArray()
    request.then((data) => {
        res.send(data)
    })
    request.catch((err) => {
        res.status(500).send("Query fallita")
    })
    request.finally(() => {
        client.close()
    })
});

app.get("/api/getPeriziaById", async (req, res, next) => {
    let _id = new ObjectId(req["query"]["_id"])
    const client = new MongoClient(connectionString)
    const collection = client.db(DBNAME).collection("perizie")
    await client.connect()
    let request = collection.findOne({ "_id": _id })
    request.then((data) => {
        res.send(data)
    })
    request.catch((err) => {
        res.status(500).send("Query fallita")
    })
    request.finally(() => {
        client.close()
    })
});

app.get("/api/checkUsername", async (req, res, next) => {
    let username = req["query"]["username"]
    const client = new MongoClient(connectionString)
    await client.connect()
    const collection = client.db(DBNAME).collection("utenti")
    let request = collection.findOne({ "username": username })
    request.then((data) => {
        if (data)
            res.send("KO")
        else
            res.send("OK")
    })
    request.catch((err) => {
        res.status(500).send("Query fallita")
    })
    request.finally(() => {
        client.close()
    })
});

app.post("/api/creaUtente", async (req, res, next) => {
    let nome = req["body"]["nome"]
    let cognome = req["body"]["cognome"]
    let username = req["body"]["username"]
    let email = req["body"]["email"]
    let oldPassword = "password"
    let isAdmin = false
    let password = ""
    let isFirstAccess = true
    let codice = req["body"]["codice"]
    const client = new MongoClient(connectionString)
    await client.connect()
    const collection = client.db(DBNAME).collection("utenti")
    let request = collection.insertOne({
        nome, cognome, username, email, password,
        oldPassword, isAdmin, isFirstAccess, codice
    })
    request.then((data) => {
        res.send(data)
    })
    request.catch((err) => {
        res.status(500).send("Query fallita")
    })
    request.finally(() => {
        client.close()
    })
});

app.patch("/api/encryptPassword", async (req, res, next) => {
    const client = new MongoClient(connectionString);
    let promise = client.connect();
    promise.then(() => {
        let collection = client.db(DBNAME).collection("utenti");
        let rq = collection.find().toArray();
        rq.then((data) => {
            let promises = []
            for (let user of data) {
                let regex = new RegExp("^\\$2[aby]\\$10\\$.{53}$")
                if (!regex.test(user.password) || user.passwordUpdated == true) {

                    let _id = new ObjectId(user._id)
                    let newPassword = _bcrypt.hashSync(user.oldPassword, 10)
                    let promise = collection.updateOne({ "_id": _id }, { "$set": { "password": newPassword, "passwordUpdated": false } })
                    promises.push(promise)
                }
            }
            Promise.all(promises).then((results) => {
                console.log("Password aggiornate correttamente " + promises.length)
            }).catch((err) => {
                console.log("Errore aggiornamento password " + err.message)
            }).finally(() => {
                client.close()
            })
        })
        rq.catch((err) => {
            console.log("Errore lettura record " + err)
            client.close()
        })
    })
    promise.catch((err) => {
        console.log("Errore connessione database " + err)
    })
})

app.patch("/api/modificaPerizia", async (req, res, next) => {
    let _id = new ObjectId(req["body"]["_id"])
    let descrizione = req["body"]["descrizione"]
    const client = new MongoClient(connectionString)
    await client.connect()
    const collection = client.db(DBNAME).collection("perizie")
    let request = collection.updateOne({ "_id": _id }, { "$set": { descrizione } })
    request.then((data) => {
        res.send(data)
    })
    request.catch((err) => {
        res.status(500).send("Query fallita")
    })
    request.finally(() => {
        client.close()
    })
});

app.patch("/api/modificaCommento", async (req, res, next) => {
    let _id = new ObjectId(req["body"]["_id"])
    let commento = req["body"]["commento"]
    let index = req["body"]["index"]
    const client = new MongoClient(connectionString)
    await client.connect()
    const collection = client.db(DBNAME).collection("perizie")
    let request = collection.updateOne({ "_id": _id }, { "$set": { ["immagini." + index + ".commento"]: commento } })
    request.then((data) => {
        res.send(data)
    })
    request.catch((err) => {
        res.status(500).send("Query fallita")
    })
    request.finally(() => {
        client.close()
    })
});

app.get("/api/getUtenti", async (req, res, next) => {
    const client = new MongoClient(connectionString)
    await client.connect()
    const collection = client.db(DBNAME).collection("utenti")
    let request = collection.find({ "username": { "$ne": "admin" } }).toArray()
    request.then((data) => {
        res.send(data)
    })
    request.catch((err) => {
        res.status(500).send("Query fallita")
    })
    request.finally(() => {
        client.close()
    })
});

app.delete("/api/eliminaUtente", async (req, res, next) => {
    let _id = new ObjectId(req["body"]["_id"])
    const client = new MongoClient(connectionString)
    await client.connect()
    const collection = client.db(DBNAME).collection("utenti")
    let request = collection.deleteOne({ "_id": _id })
    request.then((data) => {
        res.send(data)
    })
    request.catch((err) => {
        res.status(500).send("Query fallita")
    })
    request.finally(() => {
        client.close()
    })
});

/* app.post("/api/sendNewPassword", async (req, res, next) => {
    let username = req["body"]["username"]
    let password = "password"
    message = message.replace("__password", password)
    const accessToken = await OAuth2Client.getAccessToken().catch((err) => { res.status(500).send("Errore richiesta access token a google " + err) })
    console.log(accessToken)
    const auth = {
        "type": "OAuth2",
        "user": EMAIL, // process.env.email,
        "clientId": o_Auth2.client_id,
        "clientSecret": o_Auth2.client_secret,
        "refreshToken": o_Auth2.refresh_token,
        "accessToken": accessToken
    }
    const transporter = _nodemailer.createTransport({
        "service": "gmail",
        "auth": auth
    });
    let mailOptions = {
        "from": auth.user,
        "to": EMAIL,
        "subject": "Nuova password di accesso a rilievi e perizie",
        "html": message
    }
    transporter.sendMail(mailOptions, function (err, info) {
        if (err) {
            res.status(500).send("Errore invio mail\n" + err.message);
        }
        else {
            console.log("Email inviata correttamente");
            res.send({
                "ris": "OK",
                "info": info
            });
        }
    })

}) */

app.patch("/api/aggiornaPassword", async (req, res, next) => {
    let username = req["body"]["username"]
    let newPassword = req["body"]["newPassword"]
    let oldPassword = req["body"]["oldPassword"]
    let passwordUpdated = true;
    const client = new MongoClient(connectionString)
    await client.connect()
    const collection = client.db(DBNAME).collection("utenti")
    let request
    if (oldPassword == "") {
        request = collection.updateOne({ username }, { "$set": { "oldPassword": newPassword } })
    }
    else {
        request = collection.updateOne({ "username": username, "oldPassword": oldPassword }, { "$set": { "oldPassword": newPassword, "passwordUpdated": true } })
    }
    request.then((data) => {
        res.send(data)
    })
    request.catch((err) => {
        res.status(500).send("Query fallita")
    })
    request.finally(() => {
        client.close()
    })

});

// ________MOBILE________ //

app.post("/api/loginMobile", async (req, res, next) => {
    let username = req["body"]["username"]
    let password = req["body"]["password"]
    const client = new MongoClient(connectionString)
    await client.connect()
    const collection = client.db(DBNAME).collection("utenti")
    let regex = new RegExp(username, "i")
    let request = collection.findOne({ "username": regex }, { "projection": { "username": 1, "password": 1 } })
    request.then((dbUser) => {
        if (!dbUser) {
            res.status(401).send("Username not valid")
        }
        else if (dbUser.username == "admin") {
            res.status(401).send("User not authorized")
        }
        else {
            console.log("Password: " + password + " dbUser.password: " + dbUser.password)
            _bcrypt.compare(password, dbUser.password, (err, success) => {
                if (err)
                    res.status(500).send("Bcrypt compare error " + err.message)
                else {
                    if (!success) {
                        res.status(401).send("Password not valid")
                    }
                    else {
                        let token = creaToken(dbUser);
                        console.log(token)
                        res.setHeader("authorization", token)
                        res.setHeader("access-control-expose-headers", "authorization")
                        res.send({ "ris": "ok" })
                    }
                }
            })
        }
    })
    request.catch((err) => {
        res.status(500).send("Query fallita")
    })
    request.finally(() => {
        client.close()
    })
})

app.post("/api/aggiungiNuovaPerizia", async (req, res, next) => {
    let perizia = req["body"];
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("perizie");
    let request = collection.insertOne(perizia);
    request.then((data) => {
        res.send(data);
    });
    request.catch((err) => {
        res.status(500).send("Query fallita");
    });
    request.finally(() => {
        client.close();
    });
});


//********************************************************************************************//
// Default route e gestione degli errori
//********************************************************************************************//

app.use("/", (req, res, next) => {
    res.status(404);
    if (req.originalUrl.startsWith("/api/")) {
        res.send(`Api non disponibile`);
    }
    else {
        res.send(paginaErrore);
    }
});

app.use("/", (err, req, res, next) => {
    console.log("************* SERVER ERROR ***************\n", err.stack);
    res.status(500).send(err.message);
});