"use strict";

let vetUtenti = [];
let codici = [];

$(document).ready(async function () {

	let tBody = $('#tabMail tbody');
	let map = $("#map");
	let directionsRenderer;

	$("#infoPercorso").hide();

	await caricaGoogleMaps();
	getUtenti();
	getPerizie("Tutti");

	$('.js-example-basic-single').select2();

	function getUtenti() {
		let rq = inviaRichiesta("GET", "/api/getUtenti");
		rq.then((response) => {
			console.log(response.data);
			let cont = 1;
			for (let utente of response.data) {
				$("<option>").appendTo($("#utenteFilter")).prop("value", utente.codice).text(utente.cognome + " " + utente.nome);
				cont++;
				vetUtenti.push(utente.cognome + " " + utente.nome);
				codici.push(utente.codice);
			}
			$("#utenteFilter").on("change", function () {
				let utente = $("#utenteFilter").val();
				console.log(utente);
				getPerizie(utente);
			});
		})
		rq.catch((error) => {
			console.log(error);
		})
	}

	function getPerizie(utente) {
		let rq = inviaRichiesta("GET", "/api/getPerizie", { "utente": utente });
		rq.then((response) => {
			console.log(response.data);
			if (utente == "Tutti") {
				$("#nPerizie").text(response.data.length);
			}
			aggiornaMappa(response.data);
		})
		rq.catch((error) => {
			console.log(error);
		})
	}

	function aggiornaMappa(data) {
		map.empty();
		let vallauriCoords = { lat: 44.555490, lng: 7.736623 };
		let mapOptions = {
			zoom: 10.5,
			center: vallauriCoords,
			mapTypeId: google.maps.MapTypeId.ROADMAP
		};
		let mapObject = new google.maps.Map(map[0], mapOptions);
		let customIcon = {
			url: 'img/homeMarker.png',
			scaledSize: new google.maps.Size(50, 50),
		};
		let marker = new google.maps.Marker({
			position: vallauriCoords,
			map: mapObject,
			title: 'IIS G. Vallauri, Fossano (CN)',
			icon: customIcon
		});
		marker.addListener('click', function () {
			let testo = `
			<b>IIS G. Vallauri, Fossano:</b>
		`;

			Swal.fire({
				title: 'Sede',
				html: testo,
				icon: 'info',
				confirmButtonText: 'OK',
				confirmButtonColor: '#007BFF'
			})
		});
		for (let perizia of data) {
			let marker = new google.maps.Marker({
				position: { lat: perizia.latitudine, lng: perizia.longitudine },
				map: mapObject,
				title: perizia.indirizzo
			});
			marker.addListener('click', function () {
				mostraDettagliPerizia(perizia);
			});
		}
	}

	function mostraDettagliPerizia(perizia) {
		let pos = codici.indexOf(perizia.rilevatore);

		let testo = `
			<b>Nome:</b> ${perizia.nome}<br>
			<b>Descrizione:</b> ${perizia.descrizione}<br>
			<b>Indirizzo:</b> ${perizia.indirizzo}, ${perizia.città}<br>
			<b>Data e ora:</b> ${perizia.data}, ${perizia.ora}<br>`;

		if ($("#utenteFilter").val() != "Tutti") {
			testo += `<b>Rilevatore:</b> ${$("#utenteFilter option:selected").text()}<br><br>`;
		}
		else {
			let rq = inviaRichiesta("GET", "/api/getUtenteByCodice", { "codice": perizia.rilevatore });
			rq.then((response) => {
				console.log(response.data);
				if (response.data) {
					alert(response.data.cognome + " " + response.data.nome);
					testo += `<b>Rilevatore:</b> ${response.data.cognome} ${response.data.nome}<br><br>`;
				}
				else
					testo += `<b>Rilevatore:</b> Utente eliminato<br>`;

				if (perizia.immagini && perizia.immagini.length > 0) {
					testo += `
							<div id="carouselExampleIndicators" class="carousel slide" data-ride="carousel">
								<div class="carousel-inner">`;

					perizia.immagini.forEach((immagine, index) => {
						testo += `
								<div class="carousel-item ${index === 0 ? 'active' : ''}">
									<img src="${immagine.url}" class="d-block w-100" alt="Immagine ${index + 1}" title="${immagine.commento}" id="img${index}">
								</div>`;
					});

					testo += `
								</div>
								<a class="carousel-control-prev" href="#carouselExampleIndicators" role="button" data-slide="prev">
									<span class="carousel-control-prev-icon" aria-hidden="true"></span>
									<span class="sr-only">Previous</span>
								</a>
								<a class="carousel-control-next" href="#carouselExampleIndicators" role="button" data-slide="next">
									<span class="carousel-control-next-icon" aria-hidden="true"></span>
									<span class="sr-only">Next</span>
								</a>
							</div><br><br>`;
				}

				testo += `
						<button id="btnPercorso" class="btn btn-primary btn-icon">Percorso <i class="fas fa-route"></i></button>
						<button id="btnModifica" class="btn btn-warning btn-icon">Modifica <i class="fas fa-edit"></i></button>
					`;

				Swal.fire({
					title: 'Dettagli Perizia',
					html: testo,
					confirmButtonText: 'OK',
					confirmButtonColor: '#007BFF'
				});

				$("#btnModifica").on("click", function () {
					modificaDescrizionePerizia(perizia);
				});
		
				$("#btnPercorso").on("click", function () {
					visualizzaPercorso(perizia.indirizzo + ", " + perizia.città);
					$("#infoPercorso").show();
					Swal.close();
				});
		
				perizia.immagini.forEach((immagine, index) => {
					$(`#img${index}`).on("click", function () {
						mostraImmagineConCommento(perizia, immagine, index);
					});
				});
			})
			rq.catch((error) => {
				console.log(error);
			})
		}
	}

	function mostraImmagineConCommento(perizia, immagine, index) {
		Swal.fire({
			html: `<br><div style="text-align: center;"><img src="${immagine.url}" style="max-width: 100%; max-height: 80vh;"></div><p style="margin-top: 10px; font-size: 16px;">${immagine.commento}</p>`,
			showCloseButton: false,
			showConfirmButton: true,
			showCancelButton: true,
			confirmButtonText: 'Indietro',
			confirmButtonColor: '#007BFF',
			cancelButtonText: 'Modifica',
			cancelButtonColor: '#ffc107',
			icon: 'info'
		}).then((result) => {
			if (result.isConfirmed) {
				Swal.close();
				mostraDettagliPerizia(perizia);
			} else if (result.dismiss === Swal.DismissReason.cancel) {
				Swal.fire({
					title: 'Modifica Commento',
					html:
						`
						<div class="form-group">
							<input type="text" class="form-control" id="commento" value="${immagine.commento}">
						</div>
					`,
					showCancelButton: true,
					confirmButtonText: 'Salva',
					confirmButtonColor: '#007BFF',
					cancelButtonText: 'Annulla'
				}).then((result) => {
					if (result.isConfirmed) {
						let commento = $("#commento").val();
						let rq = inviaRichiesta("PATCH", "/api/modificaCommento", { "_id": perizia._id, commento, index });
						rq.then(async (response) => {
							console.log(response.data);
							await Swal.fire({
								icon: 'success',
								title: 'Commento modificato con successo!',
								showConfirmButton: false,
								timer: 1500
							});
							await getPerizie("Tutti");
							getPeriziaById(perizia._id);
						})
						rq.catch((error) => {
							console.log(error);
						})
					}
					else {
						mostraImmagineConCommento(perizia, immagine);
					}
				});
			}
		});
	}

	function getPeriziaById(_id) {
		let rq = inviaRichiesta("GET", "/api/getPeriziaById", { "_id": _id });
		rq.then((response) => {
			console.log(response.data);
			let periziaUpdated = response.data;
			mostraDettagliPerizia(periziaUpdated);
		})
		rq.catch((error) => {
			console.log(error);
		})
	}

	function visualizzaPercorso(indirizzoDestinazione) {
		let mapObject = new google.maps.Map(document.getElementById('map'), {
			zoom: 10.5,
			center: { lat: 44.555490, lng: 7.736623 },
			mapTypeId: google.maps.MapTypeId.ROADMAP
		});
		let directionsService = new google.maps.DirectionsService();
		let directionsRenderer = new google.maps.DirectionsRenderer();

		directionsRenderer.setMap(mapObject);

		let request = {
			origin: 'IIS G. Vallauri, Fossano (CN)',
			destination: indirizzoDestinazione,
			travelMode: 'DRIVING'
		};

		directionsService.route(request, function (response, status) {
			if (status == 'OK') {
				directionsRenderer.setDirections(response);
				let route = response.routes[0];
				let duration = route.legs[0].duration.text;
				$("#durataPercorso").text(`Durata stimata: ${duration}`);
			} else {
				alert('Impossibile trovare il percorso: ' + status);
			}
		});
	}


	$("#btnNascondiPercorso").on("click", function () {
		$("#map").empty();
		$("#infoPercorso").hide();
		$("#utenteFilter").val("Tutti");
		$("#utenteFilter").prop("selectedIndex", 0);

		if (directionsRenderer) {
			directionsRenderer.setMap(null);
		}
		getPerizie("Tutti");
	});

	function modificaDescrizionePerizia(perizia) {
		let idPerizia = perizia._id;
		Swal.fire({
			title: 'Modifica Descrizione',
			html:
				`
				<div class="form-group">
					<input type="text" class="form-control" id="descrizione" value="${perizia.descrizione}">
				</div>
			`,
			showCancelButton: true,
			confirmButtonText: 'Salva',
			confirmButtonColor: '#007BFF',
			cancelButtonText: 'Annulla',
			cancelButtonColor: '#6c757d'
		}).then((result) => {
			if (result.isConfirmed) {
				let descrizione = $("#descrizione").val();
				let rq = inviaRichiesta("PATCH", "/api/modificaPerizia", { "_id": idPerizia, descrizione });
				rq.then((response) => {
					console.log(response.data);
					Swal.fire({
						icon: 'success',
						title: 'Perizia modificata con successo!',
						showConfirmButton: false,
						timer: 1500
					});
					getPerizie("Tutti");
					$("#utenteFilter").val("Tutti");
				})
				rq.catch((error) => {
					console.log(error);
				})
			}
			else {
				mostraDettagliPerizia(perizia);
			}
		});
	}

	/* ************************* LOGOUT  *********************** */

	/*  Per il logout è inutile inviare una richiesta al server.
		E' sufficiente cancellare il cookie o il token dal pc client.
		Se però si utilizzano i cookies la gestione dei cookies lato client 
		è trasparente, per cui in quel caso occorre inviare una req al server */

	$("#btnLogout").on("click", function () {
		localStorage.removeItem("token")
		window.location.href = "login.html"
	});

});
