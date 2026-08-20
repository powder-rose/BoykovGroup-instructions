import { useEffect } from "react";


export default function MetaTags({
  title,
  description,
  image = "/brand/logo-icon.png",
}) {


  useEffect(() => {

    document.title = title;


    const setMeta = (property, content) => {

      let tag = document.querySelector(
        `meta[property="${property}"]`
      );


      if (!tag) {

        tag = document.createElement("meta");

        tag.setAttribute(
          "property",
          property
        );

        document.head.appendChild(tag);

      }


      tag.setAttribute(
        "content",
        content
      );

    };


    setMeta(
      "og:title",
      title
    );


    setMeta(
      "og:description",
      description
    );


    setMeta(
      "og:image",
      `https://boykovgroup.ru${image}`
    );


    setMeta(
      "og:type",
      "article"
    );


  }, [title, description, image]);


  return null;
}