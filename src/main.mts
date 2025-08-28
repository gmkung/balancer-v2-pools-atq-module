import fetch from "node-fetch";
import { ContractTag, ITagService } from "atq-types";

const SUBGRAPH_URLS: Record<string, { decentralized: string }> = {
  //All endpoints below can be found by the network logs when browsing on https://app.balancer.fi and toggling through the different chains
  // Ethereum Mainnet
  "1": {
    decentralized:
      "https://gateway-arbitrum.network.thegraph.com/api/[api-key]/deployments/id/QmQ5TT2yYBZgoUxsat3bKmNe5Fr9LW9YAtDs8aeuc1BRhj",
  },
  //Optimism
  "10": {
    decentralized:
      "https://gateway-arbitrum.network.thegraph.com/api/[api-key]/deployments/id/QmWUgkiUM5c3BW1Z51DUkZfnyQfyfesE8p3BRnEtA9vyPL",
  },
  //Gnosis
  "100": {
    decentralized:
      "https://gateway-arbitrum.network.thegraph.com/api/[api-key]/deployments/id/QmSBvRxXZbusTtbLUPRreeo1GDigfEYPioYVeWZqHRMZpV",
  },
  //Polygon
  "137": {
    decentralized:
      "https://gateway-arbitrum.network.thegraph.com/api/[api-key]/deployments/id/QmPsV39ZhPFCe4WjyQHCyPXkzWxVboeSDmrayz2b9ghSDy",
  },
  //Arbitrum
  "42161": {
    decentralized:
      "https://gateway-arbitrum.network.thegraph.com/api/[api-key]/deployments/id/QmPbjY6L1NhPjpBv7wDTfG9EPx5FpCuBqeg1XxByzBTLcs",
  },
  //Avalanche C-Chain
  "43114": {
    decentralized:
      "https://gateway-arbitrum.network.thegraph.com/api/[api-key]/deployments/id/QmeJY1ZjmuJVPvmVghZSuiSxEx2a9kmpKnjr4Qw5hNdpLU",
  },
};

interface PoolToken {
  symbol: string;
  name: string;
}

interface Pool {
  id: string;
  address: string;
  symbol: string;
  createTime: number;
  poolType: string;
  tokens: PoolToken[];
}

interface GraphQLData {
  pools: Pool[];
}

interface GraphQLResponse {
  data?: GraphQLData;
  errors?: { message: string }[]; // Assuming the API might return errors in this format
}
//defining headers for query
const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

const GET_POOLS_QUERY = `
  query GetPools($lastId: String) {
    pools(
      first: 1000,
      orderBy: id,
      orderDirection: asc,
      where: { id_gt: $lastId }
    ) {
      id
      address
      symbol
      createTime
      poolType
      tokens {
        symbol
        name  
      }
    }
  }
`;

function isError(e: unknown): e is Error {
  return (
    typeof e === "object" &&
    e !== null &&
    "message" in e &&
    typeof (e as Error).message === "string"
  );
}

const camelCaseToSpaced = (input: string): string => {
  // This regular expression finds all occurrences where a lowercase letter or a number is directly followed by an uppercase letter and inserts a space between them.
  return input.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
};

async function fetchData(
  subgraphUrl: string,
  lastId: string
): Promise<Pool[]> {
  const response = await fetch(subgraphUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: GET_POOLS_QUERY,
      variables: { lastId },
    }),
  });
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse;
  if (result.errors) {
    result.errors.forEach((error) => {
      console.error(`GraphQL error: ${error.message}`);
    });
    throw new Error("GraphQL errors occurred: see logs for details.");
  }
  if (!result.data || !result.data.pools) {
    throw new Error("No pools data found.");
  }
  return result.data.pools;
}

function prepareUrl(chainId: string, apiKey: string): string {
  const urls = SUBGRAPH_URLS[chainId];
  if (!urls || isNaN(Number(chainId))) {
    const supportedChainIds = Object.keys(SUBGRAPH_URLS).join(", ");

    throw new Error(
      `Unsupported or invalid Chain ID provided: ${chainId}. Only the following values are accepted: ${supportedChainIds}`
    );
  }
  return urls.decentralized.replace("[api-key]", encodeURIComponent(apiKey));
}

function truncateString(text: string, maxLength: number) {
  if (text.length > maxLength) {
    return text.substring(0, maxLength - 3) + "..."; // Subtract 3 for the ellipsis
  }
  return text;
}
function containsHtmlOrMarkdown(text: string): boolean {
  // Enhanced HTML tag detection that requires at least one character inside the brackets
  if (/<[^>]+>/.test(text)) {
    return true;
  }
  return false;
}

// Local helper function used by returnTags
function transformPoolsToTags(chainId: string, pools: Pool[]): ContractTag[] {
  const validPools: Pool[] = [];

  pools.forEach((pool) => {
    const poolTypeInvalid =
      containsHtmlOrMarkdown(pool.poolType) || !pool.poolType;
    const poolSymbolInvalid =
      containsHtmlOrMarkdown(pool.symbol) || !pool.symbol;
    const invalidTokenName = pool.tokens.some(
      (token) =>
        containsHtmlOrMarkdown(token.symbol) ||
        containsHtmlOrMarkdown(token.name) ||
        !token.symbol ||
        !token.name
    );

    if (poolTypeInvalid || poolSymbolInvalid || invalidTokenName) {
      console.log(
        "Pool rejected due to HTML content in pool name/symbol: " +
          JSON.stringify(pool)
      );
    } else {
      validPools.push(pool);
    }
  });

  return validPools.map((pool) => {
    const maxSymbolsLength = 45;
    //const symbolsText = pool.tokens.map((t) => t.symbol).join("/");
    const truncatedSymbolsText = truncateString(pool.symbol, maxSymbolsLength);
    return {
      "Contract Address": `eip155:${chainId}:${pool.address}`,
      "Public Name Tag": `${truncatedSymbolsText} Pool`,
      "Project Name": "Balancer v2",
      "UI/Website Link": "https://balancer.fi",
      "Public Note": `A Balancer v2 '${camelCaseToSpaced(
        pool.poolType
      )}' pool with the tokens: ${pool.tokens
        .map((t) => t.name + " (symbol: " + t.symbol + ")")
        .join(", ")}.`,
    };
  });
}

//The main logic for this module
class TagService implements ITagService {
  // Using an arrow function for returnTags
  returnTags = async (
    chainId: string,
    apiKey: string
  ): Promise<ContractTag[]> => {
    let lastId: string = "";
    let allTags: ContractTag[] = [];
    let isMore = true;

    const url = prepareUrl(chainId, apiKey);

    while (isMore) {
      try {
        const pools = await fetchData(url, lastId);
        allTags.push(...transformPoolsToTags(chainId, pools));

        isMore = pools.length === 1000;
        if (isMore) {
          lastId = pools[pools.length - 1].id;
        }
      } catch (error) {
        if (isError(error)) {
          console.error(`An error occurred: ${error.message}`);
          throw new Error(`Failed fetching data: ${error}`); // Propagate a new error with more context
        } else {
          console.error("An unknown error occurred.");
          throw new Error("An unknown error occurred during fetch operation."); // Throw with a generic error message if the error type is unknown
        }
      }
    }
    return allTags;
  };
}

// Creating an instance of TagService
const tagService = new TagService();

// Exporting the returnTags method directly
export const returnTags = tagService.returnTags;
