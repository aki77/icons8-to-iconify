#! /usr/bin/env node
// SEE: https://docs.iconify.design/tools/node/export.html

/* eslint-disable import/no-unresolved */
import tools from '@iconify/tools'
import console from 'node:console'
import process from 'node:process'
import { format } from 'node:util'

/*
   Locate directory where SVG files are

   Icons are located  in directory "svg" in @mdi/svg package

   require.resolve locates package.json
   path.dirname removes package.json from result, returning only directory
   + '/svg' adds 'svg' directory to result
*/
const source = process.argv[2]

// Target file name
const target = `${source}/icons8-color.json`

// Variable to store collection
let collection

// Options for SVGO optimization
const SVGOOptions = {
  convertShapeToPath: false,
  mergePaths: false,
}

/**
 * Import directory
 */
tools
  .ImportDir(source, {
    //  Prefix: 'mdi',
  })
  .then((result) => {
    // Copy reference so it can be used in chain of promises
    // collection is instance of tools.Collection class
    collection = result

    console.log('Imported', collection.length(), 'icons.')

    // Optimize SVG files
    //
    // collection.promiseEach() iterates all icons in collection and runs
    // promise for each icon, one at a time.
    return collection.promiseEach(
      (svg, key) =>
        new Promise((fulfill, reject) => {
          tools
            .SVGO(svg, SVGOOptions)
            .then((res) => {
              fulfill(res)
            })
            .catch((error) => {
              reject(new Error(`Error optimizing icon ${key}\n${format(error)}`))
            })
        }),
      true,
    )
  })
  .then(() =>
    // Clean up tags
    collection.promiseEach(
      (svg, key) =>
        new Promise((fulfill, reject) => {
          tools
            .Tags(svg)
            .then((res) => {
              fulfill(res)
            })
            .catch((error) => {
              reject(new Error(`Error checking tags in icon ${key}\n${format(error)}`))
            })
        }),
      true,
    ),
  )
  .then(() => {
    // Move icons origin to 0,0
    // This is not needed for most collections, but its useful to know how to do it
    const promises = []
    // eslint-disable-next-line unicorn/no-array-for-each
    collection.forEach((svg, key) => {
      if (svg.top !== 0 || svg.left !== 0) {
        const body = svg.getBody()
        if (body.includes('<defs')) {
          // Do not use this method to move icons with <defs> tags - sometimes results could be wrong
          return
        }

        let content = '<svg'
        content += ` width="${svg.width}"`
        content += ` height="${svg.height}"`
        content += ` viewBox="0 0 ${svg.width} ${svg.height}"`
        content += ' xmlns="http://www.w3.org/2000/svg">\n'
        content += `<g transform="translate(${0 - svg.left} ${0 - svg.top})">${body}</g>`
        content += '</svg>'

        svg.load(content)
        promises.push(
          new Promise((fulfill, reject) => {
            // Use SVGO to optimize icon. It will get apply transformation to shapes
            tools
              .SVGO(svg, SVGOOptions)
              .then((res) => {
                fulfill(res)
              })
              .catch((error) => {
                reject(new Error(`Error changing icon origin for ${key}\n${format(error)}`))
              })
          }),
        )
      }
    })

    return Promise.all(promises)
  })
  .then(() => {
    // Change color to "currentColor" to all icons
    // Use this only for monotone collections
    const options = {
      //  Default: 'currentColor', // change all colors to "currentColor"
      //  add: 'currentColor', // add "currentColor" to shapes that are missing color value
    }

    /*
       // For icons that have palette use this instead:
       let options = {
           add: 'currentColor',
       };
       */

    return collection.promiseEach((svg) => tools.ChangePalette(svg, options), true)
  })
  .then(() => {
    // Export JSON collection
    console.log('Exporting collection to', target)
    return tools.ExportJSON(collection, target, {
      optimize: true,
    })
  })
  .catch((error) => {
    console.error(error)
  })
