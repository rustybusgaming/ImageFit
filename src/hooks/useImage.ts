import { useState } from "react";


export function useImage(){

    const [image,setImage] = useState<string | null>(null);


    function loadImage(file: File){

        if(!file.type.startsWith("image/")){
            return;
        }

        const url = URL.createObjectURL(file);

        setImage(url);
    }


    function clearImage(){

        setImage(null);

    }


    return {
        image,
        loadImage,
        clearImage
    };

}