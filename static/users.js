$(document).ready(async function () {
    getUtenti();

    function getUtenti() {
        let rq = inviaRichiesta("GET", "/api/getUtenti");
        rq.then((response) => {
            console.log(response.data);
            for (let utente of response.data) {
                let _tr = $("<tr>").appendTo($("#tbodyUtenti"));
                $("<td>").appendTo(_tr).text(utente.cognome);
                $("<td>").appendTo(_tr).text(utente.nome);
                $("<td>").appendTo(_tr).text(utente.email);
                $("<td>").appendTo(_tr).text(utente.username);
                let deleteBtn = $("<button>").addClass("btn btn-danger btn-sm").appendTo($("<td>").appendTo(_tr).addClass("text-center"));
                $("<i>").addClass("fas fa-trash-alt").appendTo(deleteBtn);
                deleteBtn.click(() => {
                    eliminaUtente(utente._id);
                });
            }
        })
        rq.catch((error) => {
            console.log(error);
        })
    }

    function eliminaUtente(id) {
        let rq = inviaRichiesta("DELETE", "/api/eliminaUtente", { "_id": id });
        rq.then((response) => {
            console.log(response);
            Swal.fire({
                icon: 'success',
                title: 'Utente eliminato con successo!',
                showConfirmButton: false,
                timer: 1500
            });
            $("#tbodyUtenti").empty();
            getUtenti();
        })
        rq.catch((error) => {
            console.log(error);
        })
    }
});