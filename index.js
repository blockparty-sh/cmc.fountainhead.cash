// quickly tossed together
// not good code
// but does what it says it does :)

const express = require('express');
const btoa = require('btoa');
const fetch = require('node-fetch');
const port = 9099;

const app = express();


const slpdb = {
    query: (query, api_server="https://slpdb.fountainhead.cash/q/") => new Promise((resolve, reject) => {
    if (! query) {
      return resolve(false);
    }
    const b64 = btoa(JSON.stringify(query));
    const url = api_server + b64;

    console.log(url)

    fetch(url)
    .then((r) => r = r.json())
    .then((r) => {
      if (r.hasOwnProperty('error')) {
        reject(new Error(r['error']));
        return;
      }
      resolve(r);
    });
  }),

  getToken: (tokenIdHex) => ({
    "v": 3,
    "q": {
      "db": ["t"],
      "find": {
        "tokenDetails.tokenIdHex": tokenIdHex
      },
      "limit": 1
    }
  }),
};


const slpdb_servers = [
  "https://slpdb.fountainhead.cash/q/",
  "https://slpdb.bitcoin.com/q/",
  "https://oh1.slpdb.io/q/",
];

let circulatingsupply_cached = new Map();
let totalsupply_cached = new Map();

app.get('/:tokenIdHex/circulatingsupply', function (req, res) {
  const tokenIdHex = req.params["tokenIdHex"];
  if (circulatingsupply_cached.has(tokenIdHex)) {
    res.send(circulatingsupply_cached.get(tokenIdHex));
    return;
  }

  const reqs = slpdb_servers.map((api_server) => slpdb.query(slpdb.getToken(tokenIdHex), api_server));
  Promise.all(reqs)
  .then((resps) => {
    let circulating_supply_results = [];

    let cache = false;
    for (const data of resps) {
      if (data.t.length == 0) {
        continue;
      }

      const token = data.t[0];
      if (token.mintBatonUtxo === "") {
        cache = true;
      }
      circulating_supply_results.push(token.tokenStats.qty_token_circulating_supply);
    }

    if (circulating_supply_results.length == 0) {
      res.send("0");
      return;
    }

    const median_circulating_supply = circulating_supply_results.sort((a, b) => a-b)[
      Math.floor(circulating_supply_results.length/2)
    ];

    if (cache) {
      circulatingsupply_cached.set(tokenIdHex, median_circulating_supply);
    }

    res.send(median_circulating_supply);
    return;
  });
});

app.get('/:tokenIdHex/totalsupply', function (req, res) {
  const tokenIdHex = req.params["tokenIdHex"];
  if (totalsupply_cached.has(tokenIdHex)) {
    res.send(totalsupply_cached.get(tokenIdHex));
    return;
  }

  const reqs = slpdb_servers.map((api_server) => slpdb.query(slpdb.getToken(tokenIdHex), api_server));
  Promise.all(reqs)
  .then((resps) => {
    let total_supply_results = [];

    let cache = false;
    for (const data of resps) {
      if (data.t.length == 0) {
        continue;
      }

      const token = data.t[0];
      if (token.mintBatonUtxo === "") {
        cache = true;
      }
      total_supply_results.push(token.tokenStats.qty_token_minted);
    }

    if (total_supply_results.length == 0) {
      res.send("0");
      return;
    }

    const median_total_supply = total_supply_results.sort((a, b) => a-b)[
      Math.floor(total_supply_results.length/2)
    ];

    if (cache) {
      totalsupply_cached.set(tokenIdHex, median_total_supply);
    }

    res.send(median_total_supply);
    return;
  });
});


app.listen(port, () => console.log(`CMC provider listening on port ${port}!`))
