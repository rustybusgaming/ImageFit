import {resizeImage} from "../lib/imageProcessor";
import {createZip} from "../lib/zip";
import type {PlatformPreset} from "../data/platforms";


interface Props {

    image:string;

    platforms:PlatformPreset[];

}



export default function BatchExport({
    image,
    platforms
}:Props){



async function exportAll(){


    const files=[];


    for(const platform of platforms){


        const blob =
            await resizeImage(
                image,
                platform
            );


        files.push({

            name:
            `${platform.id}.${platform.format}`,

            blob

        });


    }


    await createZip(files);

}



return (

<button

disabled={!platforms.length}

onClick={exportAll}

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

Download ZIP

</button>

);

}