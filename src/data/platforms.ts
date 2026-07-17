export interface PlatformPreset {

    id: string;
    platform: string;
    name: string;

    width: number;
    height: number;

    format: "png" | "jpg" | "webp";

}



export const platforms: PlatformPreset[] = [

    {
        id: "discord-avatar",
        platform: "Discord",
        name: "Avatar",
        width: 512,
        height: 512,
        format: "png"
    },


    {
        id: "discord-banner",
        platform: "Discord",
        name: "Profile Banner",
        width: 600,
        height: 240,
        format: "png"
    },


    {
        id: "github-avatar",
        platform: "GitHub",
        name: "Profile Picture",
        width: 500,
        height: 500,
        format: "png"
    },


    {
        id: "opencollective-logo",
        platform: "Open Collective",
        name: "Logo",
        width: 1024,
        height: 1024,
        format: "png"
    },


    {
        id: "youtube-icon",
        platform: "YouTube",
        name: "Channel Icon",
        width: 800,
        height: 800,
        format: "png"
    },


    {
        id: "youtube-banner",
        platform: "YouTube",
        name: "Channel Banner",
        width: 2560,
        height: 1440,
        format: "png"
    },


    {
        id: "roblox-icon",
        platform: "Roblox",
        name: "Game Icon",
        width: 512,
        height: 512,
        format: "png"
    },


    {
        id: "twitch-avatar",
        platform: "Twitch",
        name: "Profile Picture",
        width: 256,
        height: 256,
        format: "png"
    },


];