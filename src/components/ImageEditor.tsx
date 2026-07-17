import Cropper from "react-easy-crop";
import {useState} from "react";


interface Props {

    image:string;

}


export default function ImageEditor({
    image
}:Props){


    const [crop,setCrop] = useState({
        x:0,
        y:0
    });


    const [zoom,setZoom] = useState(1);


    const [rotation,setRotation] = useState(0);



    return (

        <div className="space-y-6">


            <div
            className="
            relative
            h-[500px]
            bg-black
            rounded-xl
            overflow-hidden
            "
            >

                <Cropper

                    image={image}

                    crop={crop}

                    zoom={zoom}

                    rotation={rotation}

                    aspect={1}

                    onCropChange={setCrop}

                    onZoomChange={setZoom}

                    onRotationChange={setRotation}

                />


            </div>



            <div className="space-y-3">


                <label>
                    Zoom
                </label>


                <input

                type="range"

                min="1"

                max="3"

                step="0.1"

                value={zoom}

                onChange={(e)=>
                    setZoom(Number(e.target.value))
                }

                className="w-full"

                />


            </div>



            <div>

                <label>
                    Rotation
                </label>


                <input

                type="range"

                min="0"

                max="360"

                value={rotation}

                onChange={(e)=>
                    setRotation(Number(e.target.value))
                }

                className="w-full"

                />

            </div>


        </div>

    );

}