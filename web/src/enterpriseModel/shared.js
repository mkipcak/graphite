import { TokenSigner } from "jsontokens";
import crypto from "crypto";
const blockstack = require("blockstack");
let pubKey;
let gaiaConfig;

export async function getData(fileName, setVar) {
  let teamKey;
  let name = blockstack.loadUserData().username;
  if (name.split(".").length > 2) {
    //Here we need to load the teamKey and then fetch the file from the root username
  } else {
    //First we need to fetch the root team key
    let file = name.split(".").join("_") + "/teamPrivateKey";
    await blockstack
      .getFile(file, { decrypt: true })
      .then(file => {
        console.log("Found team key");
        teamKey = JSON.parse(file);
        blockstack
          .getFile(fileName, { decrypt: false })
          .then(fileContents => {
            let content = blockstack.decryptContent(fileContents, {
              privateKey: teamKey
            });
            if (fileContents) {
              this.setState({
                [setVar]: JSON.parse(content)
              });
            }
          })
          .catch(error => console.log(error));
      })
      .catch(error => console.log(error));
  }
}

export async function postData(data, fileName, scopesFile, key) {
  let name = blockstack.loadUserData().username;
  let encryptedData = blockstack.encryptContent(JSON.stringify(data), {
    publicKey: key
  });
  //Need to check if the SysAdmin/Root User is posting data or not
  if (name.split(".").length > 2) {
    //Need to make sure data is posted to the right location.
    //So, first we need to fetch the config file which includes access controls
    let publicKey = blockstack.getPublicKeyFromPrivate(blockstack.loadUserData().appPrivateKey);
    let file = `${scopesFile}/${publicKey}.json`;
    let user = `${blockstack.loadUserData().username.split('.')[0]}.${blockstack.loadUserData().username.split('.')[1]}`
    await blockstack.getFile(file, { username: user, decrypt: false })
      .then((file) => {
        gaiaConfig = JSON.parse(file);
      })
      .then(() => {
        //Now that we have the config file, we can upload to the scoped path.
        blockstack.uploadToGaiaHub(fileName, encryptedData, gaiaConfig);
      })
      .catch(error => console.log(error));
  } else {
    await blockstack
      .putFile(fileName, encryptedData, { encrypt: false })
      .then(() => {
        console.log("File saved");
      })
      .catch(error => console.log(error));
  }
}

export function getUserKey(filename, user) {
   return blockstack
    .getFile(filename, { username: user, decrypt: false })
    .then(file => {
      return JSON.parse(file);
    })
    .catch(error => console.log(error));
}


export function connectToGaiaHub(gaiaHubUrl, challengeSignerHex, scopes) {
  console.log(`connectToGaiaHub: ${gaiaHubUrl}/hub_info`);

  return fetch(`${gaiaHubUrl}/hub_info`)
    .then(response => response.json())
    .then(hubInfo => {
      const readURL = hubInfo.read_url_prefix;
      const token = makeV1GaiaAuthToken(
        hubInfo,
        challengeSignerHex,
        gaiaHubUrl,
        scopes
      );
      const address = blockstack.ecPairToAddress(
        blockstack.hexStringToECPair(
          challengeSignerHex + (challengeSignerHex.length === 64 ? "01" : "")
        )
      );
      return {
        url_prefix: readURL,
        address,
        token,
        server: gaiaHubUrl
      };
    });
}

export function makeV1GaiaAuthToken(hubInfo, signerKeyHex, hubUrl, scopes) {
  const challengeText = hubInfo.challenge_text;
  // const handlesV1Auth =
  //   hubInfo.latest_auth_version &&
  //   parseInt(hubInfo.latest_auth_version.slice(1), 10) >= 1;
  const iss = blockstack.getPublicKeyFromPrivate(signerKeyHex);

  const salt = crypto.randomBytes(16).toString("hex");
  const payload = {
    gaiaChallenge: challengeText,
    hubUrl,
    iss,
    salt,
    scopes
  };
  const token = new TokenSigner("ES256K", signerKeyHex).sign(payload);
  return `v1:${token}`;
}

export async function saveConfig(scopes, user, gaiaHubUrl, folderPath) {
  const gaiaConfig = await connectToGaiaHub(
    gaiaHubUrl,
    blockstack.loadUserData().appPrivateKey,
    scopes
  );
  if (pubKey) {
    const data = gaiaConfig;
    const encryptedData = blockstack.encryptContent(JSON.stringify(data), {
      publicKey: pubKey
    });
    const file = pubKey + folderPath;
    blockstack.putFile(file, encryptedData, { encrypt: false });
  } else {
    alert("User has not generated a key yet");
  }
}
