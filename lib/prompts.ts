import inquirer from "inquirer";
import {
  compilerVersions,
  licenses,
  NETWORK,
  networkNames,
} from "./constants.js";
import {
  validateCairoFileName,
  validateCompilerVersion,
  validateContractOrClassAddress,
  validateContractOrClassAddressExistence,
  validateLicense,
  validateNetwork,
  validateNonEmptyString,
} from "./validators.js";
import {
  extractAllDependenciesFullPathFromMain,
  extractCairoContractName,
  extractFilesForVerification,
  extractNileForVerification,
  extractProtostarForVerification,
  normalizeContractOrClassAddress,
  withSpinner,
} from "./utils.js";
import chalk from "chalk";
import fuzzyPath from "inquirer-fuzzy-path";

inquirer.registerPrompt("fuzzypath", fuzzyPath);

export const enterNetwork = async () => {
  const prompt = await inquirer.prompt({
    name: "network",
    type: "list",
    choices: networkNames,
    message: "Choose network that you wish to verify on:",
    validate: validateNetwork,
  });

  return prompt.network;
};

export const enterClassOrContractAddress = async (network: NETWORK) => {
  const prompt = await inquirer.prompt({
    name: "address",
    type: "input",
    message:
      "Enter the contract/class address on that network that you want to verify:",
    validate: validateContractOrClassAddress,
  });

  return prompt.address;
};

export const enterExistingClassOrContractAddress = async (network: NETWORK) => {
  while (true) {
    const address = await enterClassOrContractAddress(network);

    const doesTheAddressExist = await withSpinner(
      "Verifying the address..",
      validateContractOrClassAddressExistence(network, address)
    );

    if (doesTheAddressExist) {
      return normalizeContractOrClassAddress(address);
    }

    console.log(
      chalk.red("The address entered does not exist on the network.")
    );
  }
};

export const enterCompilerVersion = async () => {
  const prompt = await inquirer.prompt({
    name: "version",
    type: "list",
    choices: compilerVersions.reverse(),
    message: "Choose the compiler version that you wish to use:",
    validate: validateCompilerVersion,
  });

  return prompt.version;
};

export const enterLicense = async () => {
  const prompt = await inquirer.prompt({
    name: "license",
    type: "list",
    choices: licenses,
    message: "Choose the license you wish to verify under:",
    validate: validateLicense,
  });

  return prompt.license;
};

export const enterIsAccountContract = async () => {
  const prompt = await inquirer.prompt({
    name: "isAccount",
    type: "confirm",
    message: "Is this an account contract/class?",
  });

  return prompt.isAccount;
};

export const enterContractToVerify = async () => {
  const prompt = await inquirer.prompt([
    {
      type: "fuzzypath",
      name: "contract",
      excludePath: (nodePath) => nodePath.startsWith("node_modules"),
      excludeFilter: (nodePath) => !nodePath.endsWith(".cairo"),
      itemType: "file",
      message: "The contract/class to verify:",
      searchText: "Looking for the contract..",
      suggestOnly: false,
      validate: (path) => validateCairoFileName(path.value),
    },
  ]);

  return prompt.contract;
};

export const enterContractToVerifyWithValidDependencies = async () => {
  while (true) {
    const contractPath = await enterContractToVerify();
    try {
      const nile = extractNileForVerification();
      if (nile) {
        const files = await withSpinner(
          "Checking for Nile dependencies..",
          new Promise((resolve, reject) => {
            const dependencies = extractAllDependenciesFullPathFromMain(
              contractPath,
              [nile, "contracts", "."]
            );

            if (dependencies.notFound.length > 0) {
              reject(dependencies.notFound);
            } else {
              resolve(dependencies.files);
            }
          })
        );

        if (files) {
          return {
            contract: extractCairoContractName(contractPath) + ".cairo",
            files,
          };
        }
      }
    } catch (err) {
      console.log(chalk.red(`Nile was not resolved! Reason: ${err}`));
      console.log(chalk.red("Trying other verification methods"));
    }

    try {
      const protostar = extractProtostarForVerification();
      if (protostar) {
        const files = await withSpinner(
          "Checking for Protostar dependencies..",
          new Promise((resolve, reject) => {
            const dependencies = extractAllDependenciesFullPathFromMain(
              contractPath,
              protostar
            );

            if (dependencies.notFound.length > 0) {
              reject(dependencies.notFound);
            } else {
              resolve(dependencies.files);
            }
          })
        );

        if (files) {
          return {
            contract: extractCairoContractName(contractPath) + ".cairo",
            files,
          };
        }
      }
    } catch (err) {
      throw new Error(`Protostar was not resolved! Reason: ${err}`);
    }

    const files = await withSpinner(
      "Finding dependencies..",
      new Promise((resolve, reject) => {
        const { files, notFound } = extractFilesForVerification(contractPath);
        if (notFound.length) {
          reject(notFound);
        } else {
          resolve(files);
        }
      })
    );

    if (files) {
      return { contract: contractPath, files };
    }

    console.log(chalk.red("There was a problem resolving dependencies..."));
    return { contract: contractPath, files: [] };
  }
};

export const enterContractName = async (selectedContractName: string) => {
  const prompt = await inquirer.prompt({
    name: "contractName",
    type: "input",
    default: extractCairoContractName(selectedContractName),
    message: "Enter contract/class name:",
    validate: validateNonEmptyString,
  });

  return prompt.contractName;
};
