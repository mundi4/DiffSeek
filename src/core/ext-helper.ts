import { createWindowRPC } from "@/utils/createWindowRPC";

declare global {
    interface Window {
        extensionEnabled: boolean;
    }
}


type LOCAL_METHODS = {
    ping: () => Promise<string>;
};

type REMOTE_METHODS = {
    fetchImageData: (url: string) => Promise<{ data: string; contentType: string }>;
};

const rpc = createWindowRPC<LOCAL_METHODS, REMOTE_METHODS>({ source: "diffseek", timeout: 3000 });

rpc.handle({
    ping: async () => {
        return "pong";
    },
});

export async function fetchImageData(url: string) {
    const result = await rpc.call("fetchImageData", [url]);
    return result;
}