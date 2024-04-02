// Use dynamic import for node-fetch
import fetch from "node-fetch";
import { ContractTag, ITagService } from "atq-types";

const SUBGRAPH_URLS_HOSTED: Record<string, string> = {
  // Ethereum Mainnet
  "1": "https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2",
  // Polygon (MATIC)
  "137":
    "https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-polygon-v2",
  // Arbitrum
  "42161":
    "https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-arbitrum-v2",
  // Optimism
  "10": "https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-optimism-v2",
  // Gnosis Chain (formerly xDai)
  "100":
    "https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-gnosis-chain-v2",
  // Avalanche
  "43114":
    "https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-avalanche-v2",
  // Polygon zkEVM
  "1101":
    "https://api.studio.thegraph.com/query/24660/balancer-polygon-zk-v2/version/latest",
  // Base
  "84532":
    "https://api.studio.thegraph.com/query/24660/balancer-base-v2/version/latest",
};

// Updated Pool interface to match the new query structure
interface Pool {
  address: string; // Changed from 'id' to 'address'
  createTime: number;
  tokens: {
    symbol: string;
    name: string;
  }[];
}

// Updated to reflect the correct response structure based on the query
interface GraphQLResponse {
  data: {
    pools: Pool[];
  };
}

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

class TagService implements ITagService {
  // Using an arrow function for returnTags
  returnTags = async (
    chainId: string,
    apiKey: string | null
  ): Promise<ContractTag[]> => {
    let lastTimestamp: number = 0;
    let allTags: ContractTag[] = [];
    let isMore = true;

    if (apiKey === null) {
      const subgraphUrl = SUBGRAPH_URLS_HOSTED[chainId];
      if (!subgraphUrl) {
        throw new Error(`Unsupported Chain ID: ${chainId}.`);
      }

      while (isMore) {
        const response = await fetch(subgraphUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            query: GET_POOLS_QUERY,
            variables: { lastTimestamp },
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Network response was not ok: ${response.statusText}`
          );
        }
        const result = (await response.json()) as GraphQLResponse;
        const pools: Pool[] = result.data.pools;

        allTags.push(...transformPoolsToTags(chainId, pools));

        isMore = pools.length === 1000;
        if (isMore) {
          lastTimestamp = parseInt(
            pools[pools.length - 1].createTime.toString()
          );
        }
      }
    } else {
      throw new Error(
        "Queries to the decentralized Graph Network are not supported."
      );
    }

    return allTags;
  };
}

// Creating an instance of TagService
const tagService = new TagService();

// Exporting the returnTags method directly
export const returnTags = tagService.returnTags;

// Local helper function used by returnTags
function transformPoolsToTags(chainId: string, pools: Pool[]): ContractTag[] {
  return pools.map((pool) => ({
    "Contract Address": `eip155:${chainId}:${pool.address}`,
    "Public Name Tag": `${pool.tokens.map((t) => t.symbol).join("/")} Pool`,
    "Project Name": "Balancer v2",
    "UI/Website Link": "https://balancer.fi/",
    "Public Note": `A Balancer v2 pool with tokens ${pool.tokens
      .map((t) => t.name)
      .join(", ")}.`,
  }));
}
