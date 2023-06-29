import axios from "axios";
import fetch from "node-fetch";
import FormData from "form-data";
import {
  COMPILER_VERSION,
  LICENSE,
  NETWORK,
  urlByNetwork,
} from "./constants.js";

export enum VerifyJobStatus {
  SUBMITTED = 0,
  COMPILED = 1,
  COMPILE_FAILED = 2,
  FAIL = 3,
  SUCCESS = 4,
}
export type VerificationJob = {
  jobId: string
  status: VerifyJobStatus
  classHash: string
  createdTimestamp: string
  updatedTimestamp: string
  address: string
  contractName: string
  name: string
  version: string
  license: string
}

export const doesContractExist = async (network: NETWORK, address: string) => {
  try {
    const result = await fetch(
      `${urlByNetwork[network]}/api/contract/${address}`
    );
    return result.status === 200;
  } catch {
    return false;
  }
};

export const doesClassExist = async (network: NETWORK, address: string) => {
  try {
    const result = await fetch(`${urlByNetwork[network]}/api/class/${address}`);
    return result.status === 200;
  } catch {
    return false;
  }
};

export const dispatchClassVerificationJob = async (
  network: NETWORK,
  address: string,
  version: COMPILER_VERSION,
  license: LICENSE,
  isAccount: boolean,
  name: string,
  contractPath: string,
  files: { path: string; content: string }[]
) => {
  const body = new FormData();
  body.append("compiler-version", version);
  body.append("license", license);
  body.append("account-contract", isAccount.toString());
  body.append("name", name);
  body.append("contract-name", contractPath);
  Array.from({ length: files.length }).forEach((_, index) => {
    body.append(`file${index}`, files[index].content, {
      filename: files[index].path,
      filepath: files[index].path,
    });
  });

  try {
    const result = await axios<{jobId: string}>({
      method: "post",
      url: `${urlByNetwork[network]}/api/class/${address}/code`,
      data: body,
      headers: {
        "Content-Type": `multipart/form-data boundary=${body.getBoundary()}`,
        "Accept-Encoding": "gzip,deflate,compress",
      },
    });

    return result.data;
  } catch (error) {
    console.error(error); 
    throw new Error(error.response.data.message || error.response.data);
  }
};


export const pollVerificationStatus = async (
  network: NETWORK,
  jobId: string,
  maxRetries: number = 10
) => {
  // Blocking loop that polls every 2 seconds
  let retries = 0;
  let retryInterval = 500; // ms
  let lastRetryTime = Date.now();

  // Retry every 500ms until we hit maxRetries
  while (retries < maxRetries) {
    // Wait until 500 ms have passed since the last retry
    if (Date.now() - lastRetryTime < retryInterval) {
      continue;
    }
    lastRetryTime = Date.now();

    try {
      const result = await axios<VerificationJob>({
        method: "GET",
        url: `${urlByNetwork[network]}/api/class/job/${jobId}`,
      });
  
      if(result.data === null) {
        throw new Error("Job not found");
      }
      const status = Number(result.data.status);
      if(status === VerifyJobStatus.SUCCESS) {
        return result.data;
      }else if(status === VerifyJobStatus.COMPILE_FAILED) {
        throw new Error("Compilation failed");
      }else if(status === VerifyJobStatus.FAIL) {
        throw new Error("Verification failed");
      }
    } catch (error) {
      console.log(error);
      throw new Error(`Request failed: ${error.response.data.message}`);
    }

    retries = retries + 1;
  }
  // If we hit maxRetries, throw an timeout error
  throw new Error("Timeout: Verification job took too long to complete");
};