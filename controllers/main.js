const axios = require('axios');
const { request, response} = require('express');
require('dotenv').config();
const fs = require('fs');
const palabrasTresCaracteres = JSON.parse(fs.readFileSync('./controllers/palabras.json'));

const clave = process.env.API_KEY;

const obtenerPalabraAleatoria = () => {
    const randomIndex = Math.floor(Math.random() * palabrasTresCaracteres.length);
    return palabrasTresCaracteres[randomIndex];
};

const getPeliculas = async (req, res) => {

    const paginaPrincipal = fs.readFileSync('./public/templates/peliculas.html', 'utf8');

    try {
        const nombre_peliculas = [];
        const imagenes_peliculas = [];
        const sinopsis_peliculas = [];
        const id_peliculas = [];

        const obtenerInfoPelicula = async () => {
            try {
                const palabraPrimerosTresCaracteres = obtenerPalabraAleatoria();

                const { data } = await axios.get(`https://www.omdbapi.com/?t=${palabraPrimerosTresCaracteres}&apikey=${clave}`);

                if (data.Response === "True") {
                    if (data.Poster != "N/A" && data.Title != "N/A") {
                        try {
                            await axios.get(data.Poster);
                        }
                        catch (posterError) {
                            console.log('Error al obtener el póster:', posterError.message);
                        }
                        if (!(nombre_peliculas.includes(data.Title))) {
                            nombre_peliculas.push(data.Title);
                            imagenes_peliculas.push(data.Poster);
                            id_peliculas.push(data.imdbID);
                        }

                        try {
                            const { data: data2 } = await axios.get(`https://www.omdbapi.com/?apikey=${clave}&i=${data.imdbID}`);

                            if (data2.Response !== 'False' && "Plot" in data2 && data2.Plot != "N/A") {
                                sinopsis_peliculas.push(data2.Plot);
                            }
                            else {
                                sinopsis_peliculas.push("No se encontró una sinopsis");
                            }
                        }
                        catch (omdbError) {
                            console.log('Error al obtener información de la película desde OMDB:', omdbError.message);
                        }
                    }
                    else {
                        const nuevaPalabra = await obtenerPalabraAleatoria();
                        if (nuevaPalabra) {
                            return obtenerInfoPelicula(nuevaPalabra);
                        }
                    }
                }
                else {
                    // Si la respuesta de OMDB es 'False' o 'Not Found', intenta con otra palabra aleatoria
                    console.log(`La película '${palabraPrimerosTresCaracteres}' no se encontró en OMDB. Intentando con otra palabra.`);
                    const nuevaPalabra = await obtenerPalabraAleatoria();
                    if (nuevaPalabra) {
                        return obtenerInfoPelicula(nuevaPalabra);
                    }
                }
            }
            catch (error) {
                console.error(error);
                throw error;
            }
        };
        const promesas = Array.from({ length: 10 }, async () => {
            const palabra = await obtenerPalabraAleatoria();
            if (palabra) {
                return obtenerInfoPelicula(palabra);
            }
        });

        await Promise.all(promesas);

        if (nombre_peliculas.length > 0) {
            const peliculas = nombre_peliculas.map((nombre, i) => `
                <div id="${i}" class="contenedor">
                    <a href="/pelicula/${id_peliculas[i]}">
                        <img src="${imagenes_peliculas[i]}" alt="${nombre}" width="225px" height="325px">
                    </a>
                    <p class="sinopsis_pelicula">${sinopsis_peliculas[i].length <= 120 ? sinopsis_peliculas[i] + '.. <a class="enlace_pelicula" href="/pelicula/'+id_peliculas[i]+'">más</a>' : sinopsis_peliculas[i].slice(0, 120) + '... <a class="enlace_pelicula" href="/pelicula/'+id_peliculas[i]+'">más</a>'}</p>
                    <p class="nombre_pelicula">${nombre}</p>
                </div>
            `).join('');

            const articulosPeliculas = `
                <main>
                    <article>
                        <div class="articulos">
                            ${peliculas}
                        </div>
                    </article>
                </main>
            `;

            const paginaConNuevoContenido = paginaPrincipal.replace(/<main>[\s\S]*<\/main>/, `<main>${articulosPeliculas}</main>`);
            res.status(200).send(paginaConNuevoContenido);
        }
        else {
            const paginaConNuevoContenido = paginaPrincipal.replace(/<main>[\s\S]*<\/main>/, `<main><h1>No hay películas con la busqueda: '${palabraPrimerosTresCaracteres}'</h1></main>`);
            res.status(404).send(paginaConNuevoContenido);
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            status: 500,
            msg: 'Error'
        });
    }
}

const buscarPeliculas = (req, res) => {
    const { busqueda } = req.body;

    const paginaPrincipal = fs.readFileSync('./public/templates/peliculas.html', 'utf8');

    const nombre_peliculas = [];
    const imagenes_peliculas = [];
    const id_peliculas = [];
    const sinopsis_peliculas = [];

    axios.get(`https://www.omdbapi.com/?apikey=${clave}&s=${busqueda}`)
    .then(({ data }) => {
        if (data.Response !== 'False') {
            const promesas = [];

            for (const pelicula of data.Search) {
                if (pelicula.Title == "N/A" || pelicula.Poster == "N/A") {
                    continue;
                }
                else {
                    axios.get(pelicula.Poster)
                    .then(response => {
                        if (response.status === 200) {
                            nombre_peliculas.push(pelicula.Title);
                            imagenes_peliculas.push(pelicula.Poster);
                            id_peliculas.push(pelicula.imdbID);
                        }
                    })
                    .catch (() => {
                    //   console.error("imagen Not Found");
                    });

                    const promesaDetalle = axios.get(`https://www.omdbapi.com/?apikey=${clave}&i=${pelicula.imdbID}`)
                        .then(({ data: data2 }) => {
                            if (data2.Response !== 'False') {
                                if ("Plot" in data2 && data2.Plot != "N/A") {
                                    sinopsis_peliculas.push(data2.Plot);
                                }
                                else {
                                    sinopsis_peliculas.push("Error al buscar una sinopsis / No se encontró una sinopsis");
                                }
                            }
                        })
                        .catch((error) => {
                            console.log(error);
                        });

                    promesas.push(promesaDetalle);
                }
            }

            Promise.all(promesas)
            .then(() => {
                if (nombre_peliculas.length > 0) {
                    const peliculas = nombre_peliculas.map((nombre, i) => `
                        <div id="${i}" class="contenedor">
                            <a href="/pelicula/${id_peliculas[i]}">
                                <img src="${imagenes_peliculas[i]}" alt="${nombre}" width="225px" height="325px">
                            </a>
                            <p class="sinopsis_pelicula">${sinopsis_peliculas[i].length <= 120 ? sinopsis_peliculas[i] + '.. <a class="enlace_pelicula" href="/pelicula/'+id_peliculas[i]+'">más</a>' : sinopsis_peliculas[i].slice(0, 120) + '... <a class="enlace_pelicula" href="/pelicula/'+id_peliculas[i]+'">más</a>'}</p>
                            <p class="nombre_pelicula">${nombre}</p>
                        </div>
                    `).join('');

                    const articulosPeliculas = `
                        <main>
                            <article>
                                <div class="articulos">
                                    ${peliculas}
                                </div>
                            </article>
                        </main>
                    `;

                    const paginaConNuevoContenido = paginaPrincipal.replace(/<main>[\s\S]*<\/main>/, `<main>${articulosPeliculas}</main>`);
                    res.status(200).send(paginaConNuevoContenido);
                }
                else {
                    const mensajePaginaNotFound = `
                        <div class="cajaPaginaNotFound">
                            <h1>Hay muchas películas con la busqueda "${busqueda}" :)</h1>
                        </div>
                    `;

                    const paginaSinHeaderYFooter = paginaPrincipal
                    .replace(/<header>[\s\S]*<\/header>/, '')
                    .replace(/<footer>[\s\S]*<\/footer>/, '')
                    .replace(/<main>[\s\S]*<\/main>/, `<main>${mensajePaginaNotFound}</main>`);
                    res.status(200).send(paginaSinHeaderYFooter);
                }
            })
            .catch((error) => {
                console.log(error);
                res.status(400).json({
                    status: 400,
                    msg: 'Error'
                });
            });
        }
        else {
            const mensajePaginaNotFound = `
                <div class="cajaPaginaNotFound">
                    <h1>No se encontraron Películas con la busqueda "${busqueda}" :(</h1>
                </div>
            `;

            const paginaSinHeaderYFooter = paginaPrincipal
            .replace(/<main>[\s\S]*<\/main>/, `<main>${mensajePaginaNotFound}</main>`);
            res.status(200).send(paginaSinHeaderYFooter);
        }
    })
    .catch((error) => {
        console.log(error);
        res.status(400).json({
            status: 400,
            msg: 'Error'
        });
    });
};

const getPelicula = (req, res) => {  
    const { id } = req.params;

    const paginaPrincipal = fs.readFileSync('./public/templates/peliculas.html', 'utf8');

    axios.get(`https://www.omdbapi.com/?apikey=${clave}&i=${id}`)
    .then(( response ) => {

        const peli = response.data;

        const pelicula = `
            <main>
                <article>
                    <div class="info_pelicula">
                        <p>${peli.Title && peli.Title !== "N/A" ? peli.Title : 'Título no disponible'}</p>
                        <img src="${peli.Poster && peli.Poster !== "N/A" ? peli.Poster : 'Póster no disponible'}" alt="${peli.Title}">
                        <p>${peli.Plot && peli.Plot !== "N/A" ? peli.Plot : 'Trama no disponible'}</p>
                        ${peli.Director && peli.Director !== "N/A" ? `<p><strong>Director: </strong> ${peli.Director}</p>` : ''}
                        ${peli.Actors && peli.Actors !== "N/A" ? `<p><strong>Actores: </strong> ${peli.Actors}</p>` : ''}
                        ${peli.Genre && peli.Genre !== "N/A" ? `<p><strong>Género: </strong> ${peli.Genre}</p>` : ''}
                        ${peli.Year && peli.Year !== "N/A" ? `<p><strong>Año: </strong> ${peli.Year}</p>` : ''}
                    </div>
                </article>
            </main>
        `;

        const paginaConNuevoContenido = paginaPrincipal.replace(/<main>[\s\S]*<\/main>/, `<main>${pelicula}</main>`);
        res.status(200).send(paginaConNuevoContenido);
    })
    .catch((error) => {
        console.log(error);
    });
}

const wrongRequest = (req = request, res = response) => {
    const paginaPrincipal = fs.readFileSync('./public/templates/peliculas.html', 'utf8');
    
    const mensajePaginaNotFound = `
        <div class="cajaPaginaNotFound">
            <h1>Página no encontrada :(</h1>
        </div>
    `;

    const paginaSinHeaderYFooter = paginaPrincipal
    .replace(/<header>[\s\S]*<\/header>/, '')
    .replace(/<footer>[\s\S]*<\/footer>/, '')
    .replace(/<main>[\s\S]*<\/main>/, `<main>${mensajePaginaNotFound}</main>`);
    res.status(200).send(paginaSinHeaderYFooter);
}

const getDirectores = async (req, res) => {
    const paginaPrincipal = fs.readFileSync('./public/templates/peliculas.html', 'utf8');

    try {
        const directores_lista = [];
        const nombre_peliculas = [];

        const obtenerInfoPelicula = async () => {
            try {
                const palabra = obtenerPalabraAleatoria();

                const { data } = await axios.get(`https://www.omdbapi.com/?t=${palabra}&apikey=${clave}`);

                if (data.Response === "True" && "Director" in data && data.Director !== "N/A" && "Title" in data && data.Title !== "N/A") {
                    if (!nombre_peliculas.includes(data.Title)) {
                        nombre_peliculas.push(data.Title);
                        directores_lista.push(data.Director);
                    }
                } else {
                    const nuevaPalabra = await obtenerPalabraAleatoria();
                    if (nuevaPalabra) {
                        return obtenerInfoPelicula(nuevaPalabra);
                    }
                }
            } catch (error) {
                console.error(error);
                throw error;
            }
        };

        const promesas = Array.from({ length: 10 }, async () => {
            const palabra = await obtenerPalabraAleatoria();
            if (palabra) {
                return obtenerInfoPelicula(palabra);
            }
        });

        await Promise.all(promesas);

        //Sería equivalente usar:
        //for (let i = 0; i < 10; i++) {
        //    await obtenerInfoPelicula();
        //}

        if (directores_lista.length > 0) {
            const directores = directores_lista.map((director, i) => `
            <div class="directores-container">
                <h3>Director de la película: ${nombre_peliculas[i]}</h3>
                <ul class="directores-list">
                    <h3>${director}<h3>
                </ul>
            </div>
            `).join('');

            const directoresPeliculas = `
                <main>
                    <div class="directoresDiv">
                        ${directores}
                    </div>
                </main>
            `;

            const paginaConNuevoContenido = paginaPrincipal.replace(/<main>[\s\S]*<\/main>/, `<main>${directoresPeliculas}</main>`);
            res.status(200).send(paginaConNuevoContenido);
        } else {
            const mensajePaginaNotFound = `
                <div class="cajaPaginaNotFound">
                    <h1>No se encontraron Directores :(</h1>
                </div>
            `;

            const paginaSinHeaderYFooter = paginaPrincipal
                .replace(/<main>[\s\S]*<\/main>/, `<main>${mensajePaginaNotFound}</main>`);
            res.status(200).send(paginaSinHeaderYFooter);
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: 500,
            msg: 'Error'
        });
    }
}

const getPeliculasGenero = async (req, res) => {
    const { nombreGenero } = req.params;
    let generoBuscadoEnglish = "";

    switch (nombreGenero) {
        case 'aventura':
            generoBuscadoEnglish = "Adventure";
            break;
        case 'accion':
            generoBuscadoEnglish = "Action";
            break;
        case 'comedia':
            generoBuscadoEnglish = "Comedy";
            break;
        case 'drama':
            generoBuscadoEnglish = "Drama";
            break;
        case 'animacion':
            generoBuscadoEnglish = "Animation";
            break;
    }

    const paginaPrincipal = fs.readFileSync('./public/templates/peliculas.html', 'utf8');

    try {
        const generos_lista = [];
        const nombre_peliculas = [];

        const obtenerInfoPelicula = async (palabra) => {
            try {
                const palabraPrimerosTresCaracteres = obtenerPalabraAleatoria();

                const { data } = await axios.get(`https://www.omdbapi.com/?t=${palabraPrimerosTresCaracteres}&apikey=${clave}`);

                if (data.Response === "True") {
                    if ("Title" in data && "Genre" in data && data.Genre !== "N/A" && data.Title !== "N/A") {
                        const generos = data.Genre.toLowerCase().split(', ');

                        if (generos.includes(generoBuscadoEnglish.toLowerCase())) {
                            if (!(nombre_peliculas.includes(data.Title))) {
                                nombre_peliculas.push(data.Title);
                                generos_lista.push(data.Genre);
                            }
                        }
                    }
                    else {
                        const nuevaPalabra = await obtenerPalabraAleatoria();
                        if (nuevaPalabra) {
                            return obtenerInfoPelicula(nuevaPalabra);
                        }
                    }
                }
                else {
                    // Si la respuesta de OMDB es 'False' o 'Not Found', intenta con otra palabra aleatoria
                    console.log(`La película '${palabraPrimerosTresCaracteres}' no se encontró en OMDB. Intentando con otra palabra.`);
                    const nuevaPalabra = await obtenerPalabraAleatoria();
                    if (nuevaPalabra) {
                        return obtenerInfoPelicula(nuevaPalabra);
                    }
                }
            }
            catch (error) {
                console.error(error);
                throw error;
            }
        };

        const promesas = Array.from({ length: 10 }, async () => {
            const palabra = await obtenerPalabraAleatoria();
            if (palabra) {
                return obtenerInfoPelicula(palabra);
            }
        });

        await Promise.all(promesas);

        if (generos_lista.length > 0) {
            const generos = generos_lista.map((genero, i) => `
            <div class="directores-container">
                <h3>Géneros de la película: ${nombre_peliculas[i]}</h3>
                <ul class="directores-list">
                    <h3>${genero}<h3>
                </ul>
            </div>
            `).join('');

            const generosPeliculas = `
                <main>
                    <div class="directoresDiv">
                        ${generos}
                    </div>
                </main>
            `;

            const paginaConNuevoContenido = paginaPrincipal.replace(/<main>[\s\S]*<\/main>/, `<main>${generosPeliculas}</main>`);
            res.status(200).send(paginaConNuevoContenido);
        }
        else {
            const mensajePaginaNotFound = `
                <div class="cajaPaginaNotFound">
                    <h1>No se encontraron Películas con ese género :(</h1>
                </div>
            `;

            const paginaSinHeaderYFooter = paginaPrincipal
                .replace(/<main>[\s\S]*<\/main>/, `<main>${mensajePaginaNotFound}</main>`);
            res.status(200).send(paginaSinHeaderYFooter);
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            status: 500,
            msg: 'Error'
        });
    }
}

const wrongRequestGenero = (req = request, res = response) => {
    const fs = require('fs');
    const paginaPrincipal = fs.readFileSync('./public/templates/peliculas.html', 'utf8');
    
    const mensajePaginaNotFound = `
        <div class="cajaPaginaNotFound">
            <h1>Género no encontrado :(</h1>
        </div>
    `;

    const paginaModificada = paginaPrincipal
    .replace(/<main>[\s\S]*<\/main>/, `<main>${mensajePaginaNotFound}</main>`);
    res.status(200).send(paginaModificada);
}

module.exports = {
    getPeliculas,
    getPelicula,
    buscarPeliculas,
    wrongRequest,
    getDirectores,
    getPeliculasGenero,
    wrongRequestGenero
};
