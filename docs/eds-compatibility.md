# Edge Delivery Services Compatibility

## Executive position

The showcase is compatible with an AEM-backed Edge Delivery Services architecture,
but it is not an Edge Delivery Services runtime component. EDS delivers the web
experience and approved assets; the Motion Studio retrieves governed content,
previews a composition, and renders MP4 outputs in a separate worker.

## Compatibility matrix

| EDS setup | Fit | Required work |
|---|---|---|
| AEM as the EDS content source with Content Fragment Models | Strong | Map the production model and verify Cloud Service delivery/authentication |
| AEM Content Fragments consumed headlessly by Motion Studio | Strong | Current GraphQL adapter pattern; add production endpoint and publish tests |
| EDS document authoring through Google Drive/SharePoint/DA.live | Adapter required | Transform the document/block model into the Motion Studio domain contract |
| Universal Editor authoring with AEM | Strong potential | Instrument the authoring surface and expose the correct model/metadata |
| Dynamic Media with OpenAPI approved assets | Complementary | Use approved delivery URLs and validate asset allowlists/renditions |
| Running Remotion inside EDS edge delivery | Not the target | Keep rendering in an isolated Node/Chromium/FFmpeg worker |

Adobe documents EDS as supporting AEM, Google Drive, and SharePoint content sources.
The content-source choice therefore matters: this repository's current GraphQL
integration assumes AEM Content Fragments, not arbitrary EDS documents.

## Recommended architecture

```text
AEM Content Fragments / EDS authoring source
                 |
                 +--> source adapter --> validated Motion Studio campaign
                                              |
                         +--------------------+--------------------+
                         |                                         |
                   Remotion Player                         Render worker
                   marketer preview                     Remotion + FFmpeg
                                                                   |
                                                     AEM DAM / object storage
                                                                   |
                                                        EDS site or campaign CDN
```

The source adapter is the important seam. Keep the template and domain contract
stable while allowing the upstream source to be AEM GraphQL, Content Fragment
Delivery OpenAPI, or an EDS document/block representation.

## What to prove before an EDS customer pilot

1. Confirm whether the customer uses AEM as the EDS content source or document
   authoring.
2. Map one real campaign model into the existing `AemSpotlight` contract.
3. Verify the selected source's preview/publish lifecycle.
4. Verify approved Dynamic Media asset references and rendition behavior.
5. Render one approved campaign and publish the MP4 to the selected DAM/object
   storage location.
6. Confirm EDS consumes the published output through the intended delivery path.

## Official Adobe references

- [Configure the EDS content source](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/using-cloud-manager/edge-delivery-sites/configure-content-source)
- [AEM Content Fragments and GraphQL](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/content-fragments/content-fragments-graphql)
- [AEM APIs for structured content delivery](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/headless/apis-headless-and-content-fragments)
- [Universal Editor introduction](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/universal-editor/introduction)
- [AEM Assets with Edge Delivery Services](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/integrate-aem-assets-edge-delivery-services)
