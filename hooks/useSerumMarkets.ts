import { useConnection } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { useState } from "react";
import useSWR from "swr";
import { useSerum } from "../context/SerumContext";
import { useSolana } from "../context/SolanaContext";
import { MARKET_ACCOUNT_FLAGS_B58_ENCODED } from "../utils/constants";
import axios from "axios";

export type SerumMarketInfo = {
  address: PublicKey;
  baseSymbol?: string;
  quoteSymbol?: string;
};

const isLocalhost = (url: string) => {
  return url.includes("localhost") || url.includes("127.0.0.1");
};

const fetcher = async (
  programID: PublicKey,
  connection: Connection,
  isLocalhost: boolean
): Promise<SerumMarketInfo[]> => {
  let serumMarkets: SerumMarketInfo[];

  if (isLocalhost) {
    const markets = await connection.getParsedProgramAccounts(programID, {
      filters: [
        {
          memcmp: {
            offset: 5,
            bytes: MARKET_ACCOUNT_FLAGS_B58_ENCODED,
          },
        },
      ],
    });
    serumMarkets = markets.map((m) => ({ address: m.pubkey }));
  } else {
    const { data } = await axios.get<{
      tvl: number;
      total_vol_1d: number;
      markets: {
        market_address: string;
        base_symbol: string;
        quote_symbol: string;
      }[];
    }>("https://serum-volume-tracker.vercel.app/api");
    serumMarkets = data.markets.map((m) => ({
      address: new PublicKey(m.market_address),
      baseSymbol: m.base_symbol,
      quoteSymbol: m.quote_symbol,
    }));
  }

  return serumMarkets;
};

export const useSerumMarkets = () => {
  const { cluster } = useSolana();
  const { connection } = useConnection();
  const { programID } = useSerum();

  const {
    data: serumMarkets,
    isValidating,
    error,
    mutate,
  } = useSWR(
    (cluster.network === "mainnet-beta" ||
      isLocalhost(connection.rpcEndpoint)) &&
      programID &&
      connection && [
        programID,
        connection,
        isLocalhost(connection.rpcEndpoint),
      ],
    fetcher,
    {
      errorRetryCount: 1,
      // revalidateOnMount: false,
      revalidateOnFocus: false,
    }
  );

  const loading = !serumMarkets && !error;

  return {
    serumMarkets,
    loading,
    error,
    isValidating,
    mutate,
  };
};
