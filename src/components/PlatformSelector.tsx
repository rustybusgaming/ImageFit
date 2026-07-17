import {useState} from "react";
import {platforms} from "../data/platforms";
import type {PlatformPreset} from "../data/platforms";


interface Props {

    onSelect:(platforms:PlatformPreset[])=>void;

}



export default function PlatformSelector({
    onSelect
}:Props){


    const [search,setSearch] = useState("");

    const [selected,setSelected] =
        useState<PlatformPreset[]>([]);



    const filtered = platforms.filter((item)=>

        `${item.platform} ${item.name}`
        .toLowerCase()
        .includes(search.toLowerCase())

    );



    function toggle(platform:PlatformPreset){


        const exists =
            selected.some(
                item=>item.id===platform.id
            );


        let updated;


        if(exists){

            updated =
            selected.filter(
                item=>item.id!==platform.id
            );

        }

        else{

            updated=[
                ...selected,
                platform
            ];

        }


        setSelected(updated);
        onSelect(updated);

    }



    return (

        <div className="space-y-4">


            <input

            placeholder="Search platforms..."

            value={search}

            onChange={(e)=>
                setSearch(e.target.value)
            }

            className="
                w-full
                rounded-lg
                border
                p-3
            "

            />



            <div className="
                grid
                gap-3
                md:grid-cols-2
            ">


            {
            filtered.map(platform=>(


                <button

                key={platform.id}

                onClick={()=>
                    toggle(platform)
                }


                className={`

                rounded-xl
                border
                p-4
                text-left

                ${
                selected.some(
                    item=>item.id===platform.id
                )
                ?
                "bg-neutral-200 dark:bg-neutral-800"
                :
                ""
                }

                `}


                >

                <b>
                    {platform.platform}
                </b>

                <br/>

                {platform.name}


                <p className="text-sm opacity-60">

                    {platform.width}
                    ×
                    {platform.height}

                </p>


                </button>


            ))
            }


            </div>


        </div>

    );

}