let lastUserCode;

$(document).ready(async function () {
    $("#btnCreaUtente").on("click", function () {
        //controllo che tutti gli input siano pieni e aggiorno il db
        let username = $("#username").val();
        let nome = $("#nome").val();
        let cognome = $("#cognome").val();
        let email = $("#email").val();

        if (username == "" || nome == "" || cognome == "" || email == "") {
            alert("Compilare tutti i campi");
        }
        else {
            let request = inviaRichiesta("GET", "/api/checkUsername", { username });
            request.then((response) => {
                console.log(response.data);
                if (response.data == "KO") {
                    Swal.fire({
                        icon: 'error',
                        title: 'Oops...',
                        text: 'Lo username non è disponibile, si prega di sceglierne un altro!'
                    });
                }
                else {
                    creaUtente(username, nome, cognome, email);
                }
            })
            request.catch((error) => {
                console.log(error);
            })
        }
    });

    function creaUtente(username, nome, cognome, email) {
        let request = inviaRichiesta("GET", "/api/getUtenti");
        request.then((response) => {
            console.log(response.data);
            for (let utente of response.data) {
                lastUserCode = utente.codice;
            }
        })
        request.catch((error) => {
            console.log(error);
        })

        let rq = inviaRichiesta("POST", "/api/creaUtente", { "username": username, "nome": nome, "cognome": cognome, "email": email, "codice": lastUserCode + 1 });
        rq.then((response) => {
            console.log(response.data);
            Swal.fire({
                icon: 'success',
                title: 'Utente creato con successo!',
                showConfirmButton: false,
                timer: 1500
            });
            lastUserCode++;
            $("#username").val("");
            $("#nome").val("");
            $("#cognome").val("");
            $("#email").val("");
            let req = inviaRichiesta("PATCH", "/api/encryptPassword")
            req.then((response) => {
                console.log(response.data);
            })
            req.catch((error) => {
                console.log(error);
            })
        })
        rq.catch((error) => {
            console.log(error);
        })
    }
});