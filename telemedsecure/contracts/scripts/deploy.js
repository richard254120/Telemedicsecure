import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  // Account #0 from hardhat node
  const wallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);

  const artifactPath = path.join(__dirname, "../artifacts/contracts/AuditAnchor.sol/AuditAnchor.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  console.log("Deploying AuditAnchor contract...");
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("AuditAnchor deployed to:", address);

  const deploymentInfo = {
    address,
    abi: artifact.abi,
    network: "hardhat",
    deployedAt: new Date().toISOString()
  };

  const outputPath = path.join(__dirname, "../deployed.json");
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));

  // Also write to server/src/contracts/deployed.json for easy consumption
  const serverContractsDir = path.join(__dirname, "../../server/src/contracts");
  if (!fs.existsSync(serverContractsDir)) {
    fs.mkdirSync(serverContractsDir, { recursive: true });
  }
  fs.writeFileSync(path.join(serverContractsDir, "deployed.json"), JSON.stringify(deploymentInfo, null, 2));
  console.log("Deployment info written to server/src/contracts/deployed.json");
}

main().catch(console.error);
