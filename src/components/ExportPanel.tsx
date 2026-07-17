import { resizeImage } from "../lib/imageProcessor";
import { downloadBlob } from "../lib/download";
import type { PlatformPreset } from "../data/platforms";


interface Props {

    image:string;

    platform:PlatformPreset | null;

}



export default function ExportPanel({
    image,
    platform
}:Props){


    async function exportImage(){

        if(!platform){
            return;
        }


        const blob = await resizeImage(
            image,
            platform
        );


        downloadBlob(
            blob,
            `${platform.id}.${platform.format}`
        );

    }



    return (

        <button

        disabled={!platform}

        onClick={exportImage}

        className="
            mt-6
            rounded-xl
            bg-black
            text-white
            px-6
            py-3
            disabled:opacity-40
        "

        >

            Export Image

        </button>

    );

}