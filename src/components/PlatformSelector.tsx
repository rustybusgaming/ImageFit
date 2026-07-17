import { useState } from "react";
import { platforms } from "../data/platforms";
import type { PlatformPreset } from "../data/platforms";

interface Props {

    onSelect:(platform:PlatformPreset)=>void;

}



export default function PlatformSelector({
    onSelect
}:Props){


    const [search,setSearch] = useState("");



    const filtered = platforms.filter((item)=>

        `${item.platform} ${item.name}`
        .toLowerCase()
        .includes(search.toLowerCase())

    );



    return (

        <div className="space-y-4">


            <input

                value={search}

                onChange={(e)=>
                    setSearch(e.target.value)
                }

                placeholder="Search platforms..."

                className="
                    w-full
                    rounded-lg
                    border
                    p-3
                    dark:bg-neutral-900
                "

            />



            <div
            className="
            grid
            gap-3
            md:grid-cols-2
            "
            >


            {
            filtered.map((item)=>(

                <button

                key={item.id}

                onClick={()=>
                    onSelect(item)
                }

                className="
                    rounded-xl
                    border
                    p-4
                    text-left
                    hover:bg-neutral-100
                    dark:hover:bg-neutral-900
                "

                >

                    <p className="font-bold">
                        {item.platform}
                    </p>


                    <p>
                        {item.name}
                    </p>


                    <p className="text-sm opacity-60">

                        {item.width} × {item.height}

                    </p>


                </button>

            ))
            }


            </div>


        </div>

    );

}