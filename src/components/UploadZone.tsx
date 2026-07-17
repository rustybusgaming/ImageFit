import { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud } from "lucide-react";


interface UploadZoneProps {
    onUpload: (file: File) => void;
}


export default function UploadZone({
    onUpload
}: UploadZoneProps) {

    const [preview, setPreview] = useState<string | null>(null);


    function handleFile(file: File) {

        if (!file.type.startsWith("image/")) {
            return;
        }


        const url = URL.createObjectURL(file);

        onUpload(file);

        setPreview(url);

    }


    useEffect(() => {

        return () => {

            if (preview) {
                URL.revokeObjectURL(preview);
            }

        };

    }, [preview]);



    const {
        getRootProps,
        getInputProps
    } = useDropzone({

        accept: {
            "image/*": []
        },

        multiple: false,

        onDrop: (acceptedFiles) => {

            const file = acceptedFiles[0];

            if (file) {
                handleFile(file);
            }

        }

    });



    return (

        <div className="space-y-6">


            <div
                {...getRootProps()}
                className="
                    cursor-pointer
                    border-2
                    border-dashed
                    rounded-xl
                    p-12
                    text-center
                    transition
                    hover:bg-neutral-100
                    dark:hover:bg-neutral-900
                "
            >

                <input {...getInputProps()} />


                <UploadCloud
                    className="
                        mx-auto
                        mb-4
                        h-12
                        w-12
                    "
                />


                <p className="text-lg">
                    Drop an image here
                </p>


                <p className="text-sm opacity-60">
                    or click to browse
                </p>


            </div>



            {preview && (

                <div className="flex justify-center">

                    <img
                        src={preview}
                        alt="Uploaded preview"
                        className="
                            max-h-80
                            rounded-xl
                            shadow
                        "
                    />

                </div>

            )}


        </div>

    );

}