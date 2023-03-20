#!/usr/bin/env node

import chalk from "chalk";
import clear from "clear";
import figlet from "figlet";
import { COMPILER_VERSION, LICENSE, NETWORK } from "./lib/constants.js";
import {
  enterClassOrContractAddress,
  enterCompilerVersion,
  enterLicense,
  enterIsAccountContract,
  enterContractName,
  enterNetwork,
  enterExistingClassOrContractAddress,
  enterContractToVerify,
  enterContractToVerifyWithValidDependencies,
} from "./lib/prompts.js";
import { verifyContractOrClass } from "./lib/requests.js";
import { withSpinner } from "./lib/utils.js";

(async () => {
  clear();

  console.log(
    chalk.yellow(figlet.textSync("Voyager", { horizontalLayout: "full" }))
  );
  console.log(
    chalk.yellow(figlet.textSync("CLI Verifier", { horizontalLayout: "full" }))
  );

  try {
    const network: NETWORK = await enterNetwork();
    const address: string = await enterExistingClassOrContractAddress(network);
    const version: COMPILER_VERSION = await enterCompilerVersion();
    const license: LICENSE = await enterLicense();
    const isAccount: boolean = await enterIsAccountContract();
    const { contract, files } = <{ contract: any; files: any[] }>(
      await enterContractToVerifyWithValidDependencies()
    );

    const fileSet = new Set<string>();
    const uniqueFiles = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (fileSet.has(file.path)) {
        continue;
      }
      fileSet.add(file.path);
      uniqueFiles.push(file);
    }

    const contractName: string = await enterContractName(contract);
    await withSpinner(
      "Verifying the contract..",
      verifyContractOrClass(
        network,
        address,
        version,
        license,
        isAccount,
        contractName,
        contract,
        uniqueFiles
      )
    );
    console.log(
      chalk.green(
        "The verification was successful, thank you for using Voyager!"
      )
    );
  } catch (error) {
    console.log(chalk.red(error));
  }
})();
