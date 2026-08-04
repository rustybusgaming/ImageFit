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
        id: "instagram-square",
        platform: "Instagram",
        name: "Square post",
        width: 1080,
        height: 1080,
        format: "jpg"
    },
    {
        id: "instagram-portrait",
        platform: "Instagram",
        name: "Portrait post",
        width: 1080,
        height: 1350,
        format: "jpg"
    },
    {
        id: "instagram-story",
        platform: "Instagram",
        name: "Story or Reel cover",
        width: 1080,
        height: 1920,
        format: "jpg"
    },

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
        id: "linkedin-banner",
        platform: "LinkedIn",
        name: "Profile banner",
        width: 1584,
        height: 396,
        format: "jpg"
    },
    {
        id: "linkedin-post",
        platform: "LinkedIn",
        name: "Landscape post",
        width: 1200,
        height: 627,
        format: "jpg"
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
    {
        id: "twitch-banner",
        platform: "Twitch",
        name: "Profile banner",
        width: 1200,
        height: 480,
        format: "png"
    },
    {
        id: "x-header",
        platform: "X",
        name: "Profile header",
        width: 1500,
        height: 500,
        format: "jpg"
    },
    {
        id: "tiktok-cover",
        platform: "TikTok",
        name: "Video cover",
        width: 1080,
        height: 1920,
        format: "jpg"
    },

];