import express from 'express'
import cors from 'cors';
import * as fs from "fs";

require('dotenv').config()

const PORT = 3001;

const app = express();
app.use(express.json());
app.use(cors());

app.get("/mintNFTData", async function (req, res) {
  let returnArray = [];

  for(var i = 1;i <= 2; i++) {
    const fileData = fs.readFileSync(`./assets/metadata/${i}.png`);
    returnArray.push(fileData);
  }
  res.json(returnArray);
});

app.listen(PORT, () => {
  console.log(`Backend listening at http://localhost:${PORT}`);
});
