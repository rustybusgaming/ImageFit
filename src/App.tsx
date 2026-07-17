import { useState } from "react";

import UploadZone from "./components/UploadZone";
import PlatformSelector from "./components/PlatformSelector";
import type { PlatformPreset } from "./data/platforms";
import ImageEditor from "./components/ImageEditor";
import ExportPanel from "./components/ExportPanel";
import { useImage } from "./hooks/useImage";


export default function App() {

    const {
        image,
        loadImage
    } = useImage();


    const [selectedPlatforms, setSelectedPlatforms] =
         useState<PlatformPreset[]>([]);


    return (

        <main
            className="
                min-h-screen
                bg-white
                dark:bg-black
                text-black
                dark:text-white
                p-8
            "
        >

            <div
                className="
                    max-w-5xl
                    mx-auto
                "
            >

                <h1 className="text-5xl font-bold mb-3">
                    ImageFit
                </h1>


                <p className="opacity-60 mb-10">
                    Resize once. Export everywhere.
                </p>



                {!image && (

                    <UploadZone
                        onUpload={loadImage}
                    />

                )}



                {image && (

                    <>

                        <ImageEditor
                            image={image}
                        />


                        <div className="mt-10">

                            <PlatformSelector
                                onSelect={setSelectedPlatforms}
                            />

                        </div>


                    </>

                )}




                {selectedPlatform && (

                    <div className="mt-6 rounded-xl border p-5">

                        <h2 className="text-xl font-bold">
                            Selected
                        </h2>


                        <p>
                            {selectedPlatform.platform}
                            {" - "}
                            {selectedPlatform.name}
                        </p>


                        <p className="opacity-60">

                            {selectedPlatform.width}
                            ×
                            {selectedPlatform.height}

                            {" "}
                            {selectedPlatform.format.toUpperCase()}

                        </p>


                    </div>

                )}



                {image && (

                    <ExportPanel

                        image={image}

                        platform={selectedPlatform}

                    />

                )}


            </div>

        </main>

    );

}