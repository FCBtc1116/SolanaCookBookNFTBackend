import express from 'express'
import cors from 'cors';
import * as fs from "fs";
import Arweave from 'arweave';
import Bundlr from "@bundlr-network/client"
import key from "./assets/key.json";
import { actions, NodeWallet, Wallet } from '@metaplex/js';
import { Metadata } from '@metaplex-foundation/mpl-token-metadata';
import { Keypair, SystemProgram, Transaction, Connection, PublicKey, sendAndConfirmTransaction, clusterApiUrl } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';

require('dotenv').config()

const PORT = 3001;

const app = express();
app.use(express.json());
app.use(cors());

app.get("/mintNFTData", async function (req, res) {
  let videoUrl;
  let metadata = undefined;  
  const bundlr = new Bundlr("https://devnet.bundlr.network", "solana", key, { providerUrl: "https://api.devnet.solana.com" });
  const balance = await bundlr.getLoadedBalance();
  const secretKey = Uint8Array.from(key);
  let keypair = Keypair.fromSecretKey(secretKey);

  bundlr.utils.unitConverter(balance);
  for(var i = 1;i >= 0; i--) {
    console.log(i+"th mint");

    await bundlr.fund(100_000_000);
    const tags = [{name: "Content-Type", value: "image/png"}];

    const bundltransaction = await bundlr.createTransaction(fs.readFileSync(`./assets/metadata/${i + 1}.png`), {tags : tags});
    
    await bundltransaction.sign();
    await bundltransaction.upload();

    const { id } = bundltransaction;
    videoUrl = id ? `https://arweave.net/${id}` : undefined;
    console.log(videoUrl);

    metadata = await require(`./assets/metadata/${i + 1}.json`);

    metadata['properties'] = {
      files: [
        {
          uri: videoUrl,
          type: "image/png",
        },
      ],
      category: "png",
      maxSupply: 0,
      creators: [
        {
          address: keypair.publicKey,
          share: 100,
        },
      ],
    };
    metadata['video'] = videoUrl;
    console.log(metadata);

    const jsonTags = [{name: "Content-Type", value: "application/json"}];

    const metadataRequest = JSON.stringify(metadata);
    
    const metadataTransaction = bundlr.createTransaction(metadataRequest, {tags : jsonTags});
    await metadataTransaction.sign();
    await metadataTransaction.upload();

    const url = metadataTransaction.id;
    videoUrl = url ? `https://arweave.net/${url}` : undefined;

    console.log(videoUrl);

    const connection = new Connection("https://api.devnet.solana.com");
  
    //Step1. Mint NFT
    const mintNFTResponse = await actions.mintNFT({
      connection,
      wallet: new NodeWallet(keypair),
      uri: videoUrl!,
      maxSupply: 1
    });
    console.log(`${i} NFTs are minted ${mintNFTResponse.mint.toBase58()}`);

    // step 2. create associated account to user
    let ata = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID, // always ASSOCIATED_TOKEN_PROGRAM_ID
      TOKEN_PROGRAM_ID, // always TOKEN_PROGRAM_ID
      mintNFTResponse.mint, // mint
      keypair.publicKey // owner
    );
    console.log(`ATA: ${ata.toBase58()}`);
    console.log(keypair.publicKey.toBase58());
    let tx = new Transaction().add(
      Token.createAssociatedTokenAccountInstruction(
        ASSOCIATED_TOKEN_PROGRAM_ID, // always ASSOCIATED_TOKEN_PROGRAM_ID
        TOKEN_PROGRAM_ID, // always TOKEN_PROGRAM_ID
        mintNFTResponse.mint, // mint
        ata, // ata
        keypair.publicKey, // owner of token account
        keypair.publicKey // fee payer
      )
    );
    await (new Promise(resolve => setTimeout(resolve, 20000)));
    console.log(tx.instructions);
    let rlt = await connection.sendTransaction(tx, [keypair]);
    console.log(rlt);

    // step 3. send NFT to user
    // Add token transfer instructions to transaction
    let fromTokenAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID, // always ASSOCIATED_TOKEN_PROGRAM_ID
      TOKEN_PROGRAM_ID, // always TOKEN_PROGRAM_ID
      mintNFTResponse.mint, // mint
      keypair.publicKey // owner
    );
    let toTokenAccount = ata;
    await (new Promise(resolve => setTimeout(resolve, 20000)));
    const transaction = new Transaction().add(
      Token.createTransferInstruction(
        TOKEN_PROGRAM_ID,
        fromTokenAccount,
        toTokenAccount,
        keypair.publicKey,
        [],
        1,
      ),
    );

    // Sign transaction, broadcast, and confirm
    let finalResult = await sendAndConfirmTransaction(
      connection,
      transaction,
      [keypair]
    );
    console.log("finalResult", finalResult);
  
  }
  res.json(true);
});

app.post("/testUpload", async function(req,res) {
  const key = JSON.parse(fs.readFileSync("wallet.json").toString());
  const bundlr = new Bundlr("https://devnet.bundlr.network", "solana", key, { providerUrl: "https://api.devnet.solana.com" });
  const balance = await bundlr.getLoadedBalance();
  bundlr.utils.unitConverter(balance);
  await bundlr.fund(100_000_000);
  const data = fs.readFileSync("./assets/metadata/1.png");
  const tags = [{name: "Content-Type", value: "image/png"}];
  const tx = bundlr.createTransaction(data, {tags : tags});
  const size = tx.size;
  await bundlr.getPrice(size);
  await tx.sign();
  const id = tx.id;
  await tx.upload();
  console.log(`https://arweave.net/${id}`);
});

app.listen(PORT, () => {
  console.log(`Backend listening at http://localhost:${PORT}`);
});
