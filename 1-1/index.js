const express = require('express');
const port = 4545;
const http = require('http');
const { createSocketServer } = require('./socketServer');

function createApp() {
    const app = express();
    app.use(express.static("public"));
    app.use(express.json());

    // Set EJS as the view engine
    app.set('view engine', 'ejs');
    app.get('/', (req, res) => {
        res.render('index');
    });

    return app;
}

const app = createApp();
const server = http.createServer(app);
server.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`)
});

createSocketServer(server);
