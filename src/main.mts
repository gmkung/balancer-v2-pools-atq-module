// Use dynamic import for node-fetch
import fetch from "node-fetch";
import { ContractTag, ITagService } from "atq-types";

const SUBGRAPH_URLS: Record<
  string,
  { hosted: string; decentralized: string | null }
> = {
  // Ethereum Mainnet
  "1": {
    hosted: "https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2",
    decentralized:
      "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/GAWNgiGrA9eRce5gha9tWc7q5DPvN3fs5rSJ6tEULFNM",
  },
  // Polygon (MATIC)
  "137": {
    hosted:
      "https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-polygon-v2",
    decentralized: null, // Assuming decentralized URL is not available for this chain
  },
  // Arbitrum
  "42161": {
    hosted:
      "https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-arbitrum-v2",
    decentralized: null, // Assuming decentralized URL is not available for this chain
  },
  // Optimism
  "10": {
    hosted:
      "https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-optimism-v2",
    decentralized: null,
  },
  // Gnosis Chain (formerly xDai)
  "100": {
    hosted:
      "https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-gnosis-chain-v2",
    decentralized: null, // Assuming decentralized URL is not available for this chain
  },
  // Avalanche
  "43114": {
    hosted:
      "https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-avalanche-v2",
    decentralized: null,
  },
  // Polygon zkEVM
  "1101": {
    hosted:
      "https://api.studio.thegraph.com/query/24660/balancer-polygon-zk-v2/version/latest",
    decentralized: null, // Assuming decentralized URL is not available for this chain
  },
  // Base
  "84532": {
    hosted:
      "https://api.studio.thegraph.com/query/24660/balancer-base-v2/version/latest",
    decentralized: null, // Assuming decentralized URL is not available for this chain
  },
};

// Updated Pool interface to match the new query structure

interface PoolToken {
  symbol: string;
  name: string;
}

interface Pool {
  address: string; // Changed from 'id' to 'address'
  createTime: number;
  tokens: PoolToken[];
}

// Updated to reflect the correct response structure based on the query
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
  query GetPools($lastTimestamp: Int) {
    pools(
      first: 1000,
      orderBy: createTime,
      orderDirection: asc,
      where: { createTime_gt: $lastTimestamp }
    ) {
      address
      createTime
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

async function fetchData(
  subgraphUrl: string,
  lastTimestamp: number
): Promise<Pool[]> {
  const response = await fetch(subgraphUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: GET_POOLS_QUERY,
      variables: { lastTimestamp },
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

function prepareUrl(chainId: string, apiKey: string | null): string {
  const urls = SUBGRAPH_URLS[chainId];
  if (!urls || isNaN(Number(chainId))) {
    throw new Error(`Unsupported or invalid Chain ID provided: ${chainId}.`);
  }
  return apiKey && urls.decentralized
    ? urls.decentralized.replace("[api-key]", encodeURIComponent(apiKey))
    : urls.hosted;
}

function truncateString(text: string, maxLength: number) {
  if (text.length > maxLength) {
    return text.substring(0, maxLength - 3) + "..."; // Subtract 3 for the ellipsis
  }
  return text;
}

// Local helper function used by returnTags
function transformPoolsToTags(chainId: string, pools: Pool[]): ContractTag[] {
  return pools.map((pool) => {
    const maxSymbolsLength = 45;
    const symbolsText = pool.tokens.map((t) => t.symbol).join("/");
    const truncatedSymbolsText = truncateString(symbolsText, maxSymbolsLength);
    return {
      "Contract Address": `eip155:${chainId}:${pool.address}`,
      "Public Name Tag": `${truncatedSymbolsText} Pool`,
      "Project Name": "Balancer v2",
      "UI/Website Link": "https://balancer.fi",
      "Public Note": `A Balancer v2 pool with the tokens: ${pool.tokens
        .map((t) => t.name)
        .join(", ")}.`,
    };
  });
}

//The main logic for this module
class TagService implements ITagService {
  // Using an arrow function for returnTags
  returnTags = async (
    chainId: string,
    apiKey: string | null
  ): Promise<ContractTag[]> => {
    let lastTimestamp: number = 0;
    let allTags: ContractTag[] = [];
    let isMore = true;

    const url = prepareUrl(chainId, apiKey); // Ensure you have a function to get the right URL

    while (isMore) {
      try {
        const pools = await fetchData(url, lastTimestamp);
        allTags.push(...transformPoolsToTags(chainId, pools));

        isMore = pools.length === 1000;
        if (isMore) {
          lastTimestamp = parseInt(
            pools[pools.length - 1].createTime.toString(),
            10
          );
        }
      } catch (error) {
        if (isError(error)) {
          console.error(`An error occurred: ${error.message}`);
        } else {
          console.error("An unknown error occurred.");
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
