import JSZip from "jszip";
import { saveAs } from "file-saver";


export async function createZip(
    files: {
        name:string;
        blob:Blob;
    }[]
){

    const zip = new JSZip();


    for(const file of files){

        zip.file(
            file.name,
            file.blob
        );

    }


    const content = await zip.generateAsync({
        type:"blob"
    });


    saveAs(
        content,
        "imagefit-export.zip"
    );

}