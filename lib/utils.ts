import { BigNumber, utils } from "ethers";
import fs from "fs";
import path from "path";
import TOML from "@iarna/toml";
import { Spinner } from "cli-spinner";
import {
  NILE_FOLDER_NAME,
  PROTOSTAR_FILE_NAME,
  pythonVersions,
} from "./constants.js";

export const getCurrentDirectoryBase = () => {
  return path.basename(process.cwd());
};

export const directoryExists = (filePath) => {
  return fs.existsSync(filePath);
};

export const normalizeContractOrClassAddress = (address: string) => {
  return utils.hexZeroPad(BigNumber.from(address).toHexString(), 32);
};

export const withSpinner = async (
  spinnerMessage: string,
  promise: Promise<any>
) => {
  const spinner = new Spinner(`${spinnerMessage} %s`);
  spinner.setSpinnerString("|/-\\");
  spinner.start();

  const result = await promise.finally(() => spinner.stop(true));

  return result;
};

export const extractCairoContractName = (name: string) => {
  const parsedPath = path.parse(name);
  return parsedPath.name;
};

export const extractFilesForVerification = (contractPath: string) => {
  const CONTRACT_IMPORT_REGEX = /^from (?!starkware)(.*) import/gm;
  const files = [];
  const notFound = [];

  const pathsToExtract = [contractPath];
  while (pathsToExtract.length) {
    const filePath = pathsToExtract.pop();

    const exists = fs.existsSync(filePath);
    if (exists) {
      const contractContents: string = fs.readFileSync(filePath, "utf-8");

      const contract = { path: filePath, content: contractContents };
      files.push(contract);

      const dependencies = [
        ...contractContents.matchAll(CONTRACT_IMPORT_REGEX),
      ].flatMap((x) => {
        const split = x[1].split(".");
        const fullPath = path.join(...split) + ".cairo";

        return fullPath;
      });

      pathsToExtract.push(...dependencies);
    } else {
      notFound.push(filePath);
    }
  }

  if (notFound.length) {
    throw new Error(
      `The following files have not been found, please provide them.: ${notFound.join(
        ", "
      )}`
    );
  }

  return { files, notFound };
};

export const extractNileForVerification = () => {
  const { VIRTUAL_ENV } = process.env;
  return VIRTUAL_ENV
    ? pythonVersions
        .map((version) =>
          path.join(VIRTUAL_ENV, "lib", version, "site-packages")
        )
        .find((path) => fs.existsSync(path)) || null
    : null;
};

export const extractProtostarForVerification = () => {
  if (fs.existsSync(PROTOSTAR_FILE_NAME)) {
    const protostar = TOML.parse(fs.readFileSync(PROTOSTAR_FILE_NAME, "utf-8"));

    if (!protostar) {
      return null;
    }

    return [
      ...(protostar["protostar.build"]?.["cairo-path"] || []),
      ...(protostar["protostar.shared_command_configs"]?.["cairo-path"] || []),
      ...(protostar["project"]?.["cairo-path"] || []),
    ];
  } else {
    return null;
  }
};

type DependencyResult = {
  dependenciesFullPaths: string[];
  files: any[];
  checkedDependencies: string[];
  notFound: string[];
};

const convertCairoImportToFilePath = (cairoImportStr: string) => {
  const el = cairoImportStr.split(".");
  const filePath = path.join(...el);

  return filePath + ".cairo";
};

const extractDependenciesFromCairoFile = (cairoFilePath: string) => {
  const IMPORT_REGEX = /^from (?!starkware)(.*) import/gm;
  const content = fs.readFileSync(cairoFilePath, "utf-8");
  const matches = [...content.matchAll(IMPORT_REGEX)];
  if (matches.length === 0) {
    return [];
  }

  const dependencies = matches.map((match) => {
    return match[1];
  });
  return dependencies;
};

export const extractAllDependenciesFullPathFromMain = (
  mainCairoFilePath: string,
  cairoPaths: string[]
): DependencyResult => {
  const dependenciesFullPaths: string[] = [];
  const checkedDependencies: string[] = [];
  const files = [];
  const notFound: string[] = [];

  const extractDependenciesFullPath = (cairoFilePath: string) => {
    const fileDependencies = extractDependenciesFromCairoFile(cairoFilePath);

    if (fileDependencies.length === 0) {
      return;
    }

    for (let i = 0; i < fileDependencies.length; i++) {
      const dependency = fileDependencies[i];
      if (checkedDependencies.some((e) => e === dependency)) {
        continue;
      }

      let isFound = false;
      const fp = convertCairoImportToFilePath(dependency);

      for (let i = 0; i < cairoPaths.length; i++) {
        const cairoPath = cairoPaths[i];
        const fullPath = path.join(cairoPath, fp);
        const isExist = fs.existsSync(fullPath);

        if (isExist) {
          isFound = true;
          checkedDependencies.push(dependency);
          dependenciesFullPaths.push(fullPath);
          extractDependenciesFullPath(fullPath);

          const contractContents = fs.readFileSync(fullPath, "utf-8");
          const contract = { path: fp, content: contractContents };
          files.push(contract);

          break;
        }
      }

      if (!isFound) {
        notFound.push(fp);
      }
    }
  };



  const contractContents = fs.readFileSync(mainCairoFilePath, "utf-8");
  const contract = { path: mainCairoFilePath, content: contractContents };
  files.push(contract);

  extractDependenciesFullPath(mainCairoFilePath);

  return {
    dependenciesFullPaths,
    files,
    checkedDependencies,
    notFound,
  };
};
