import _http from "http";
import _url from "url";
import _fs from "fs";
import _express from "express";
import _dotenv from "dotenv";
import _cors from "cors";

// Lettura delle password
_dotenv.config({ "path": ".env" });

// Variabili relative a MongoDB ed Express
import { MongoClient, ObjectId } from "mongodb";
const DBNAME = "unicorns";
const connectionString: string = process.env.connectionStringAtlas;
const app = _express();

// Variabili generiche
const PORT: number = 1337;
let paginaErrore;

// app è il router di Express, si occupa di tutta la gestione delle richieste http
const server = _http.createServer(app);

// Il secondo parametro facoltativo ipAddress consente di mettere il server in ascolto su una delle interfacce della macchina, se non lo metto viene messo in ascolto su tutte le interfacce (3 --> loopback e 2 di rete)
server.listen(PORT, () => {
    init();
    console.log(`Il Server è in ascolto sulla porta ${PORT}`);
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

//********************************************************************************************//
// Routes middleware
//********************************************************************************************//

// 1. Request log
app.use("/", (req: any, res: any, next: any) => {
    console.log(`-----> ${req.method}: ${req.originalUrl}`);
    next();
});

// 2. Gestione delle risorse statiche
// .static() è un metodo di express che ha già implementata la firma di sopra. Se trova il file fa la send() altrimenti fa la next()
app.use("/", _express.static("./static"));

// 3. Lettura dei parametri POST di req["body"] (bodyParser)
// .json() intercetta solo i parametri passati in json nel body della http request
app.use("/", _express.json({ "limit": "50mb" }));
// .urlencoded() intercetta solo i parametri passati in urlencoded nel body della http request
app.use("/", _express.urlencoded({ "limit": "50mb", "extended": true }));

// 4. Log dei parametri GET, POST, PUT, PATCH, DELETE
app.use("/", (req: any, res: any, next: any) => {
    if (Object.keys(req["query"]).length > 0) {
        console.log(`       ${JSON.stringify(req["query"])}`);
    }
    if (Object.keys(req["body"]).length > 0) {
        console.log(`       ${JSON.stringify(req["body"])}`);
    }
    next();
});

// 5. Controllo degli accessi tramite CORS
const corsOptions = {
    origin: function (origin, callback) {
        return callback(null, true);
    },
    credentials: true
};
app.use("/", _cors(corsOptions));

//********************************************************************************************//
// Routes finali di risposta al client
//********************************************************************************************//

app.get("/api/getCollections", async (req, res, next) => {
    const client = new MongoClient(connectionString);
    await client.connect();
    let db = client.db(DBNAME);
    // db.listCollections() richiede al server l'elenco delle collezioni presenti nel db
    let rq = db.listCollections().toArray();
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore nella lettura delle collezioni: ${err}`));
    rq.finally(() => client.close());
});

app.get("/api/:collection", async (req, res, next) => {
    let filters = req["query"];
    let selectedCollection = req["params"].collection;
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection(selectedCollection);
    let rq = collection.find(filters).toArray();
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

app.get("/api/:collection/:id", async (req, res, next) => {
    let selectedCollection = req["params"].collection;
    let objId = new ObjectId(req["params"].id);
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection(selectedCollection);
    let rq = collection.findOne({ "_id": objId });
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

app.post("/api/:collection", async (req, res, next) => {
    let newRecord = req["body"];
    let selectedCollection = req["params"].collection;
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection(selectedCollection);
    let rq = collection.insertOne(newRecord);
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

app.delete("/api/:collection/:id", async (req, res, next) => {
    let selectedCollection = req["params"].collection;
    let objId = new ObjectId(req["params"].id);
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection(selectedCollection);
    let rq = collection.deleteOne({ "_id": objId });
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

app.delete("/api/:collection", async (req, res, next) => {
    let selectedCollection = req["params"].collection;
    let filters = req["body"];
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection(selectedCollection);
    let rq = collection.deleteMany(filters);
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

app.patch("/api/:collection/:id", async (req, res, next) => {
    let selectedCollection = req["params"].collection;
    let objId = new ObjectId(req["params"].id);
    let updatedRecord = req["body"];
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection(selectedCollection);
    let rq = collection.updateOne({ "_id": objId }, { "$set": updatedRecord });
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

app.patch("/api/:collection", async (req, res, next) => {
    let selectedCollection = req["params"].collection;
    let filters = req["body"].filters;
    let action = req["body"].action;
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection(selectedCollection);
    let rq = collection.updateMany(filters, action);
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

app.put("/api/:collection/:id", async (req, res, next) => {
    let selectedCollection = req["params"].collection;
    let objId = new ObjectId(req["params"].id);
    let updatedRecord = req["body"];
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection(selectedCollection);
    let rq = collection.replaceOne({ "_id": objId }, updatedRecord);
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
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