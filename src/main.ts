import http from "http";
import express from "express";
import sslRedirect from "heroku-ssl-redirect";

const app = express();
app.use(sslRedirect());

const server = http.createServer(app);

app.all("*", (req, res) => {
    res.redirect(301, "https://aupro.xyz")
});


const port = process.env.PORT || 8079;
server.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
