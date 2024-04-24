"use strict"

$(document).ready(function() {	
	let _username = $("#usr")
	let _password = $("#pwd")
	let _lblErrore = $("#lblErrore")
    _lblErrore.hide();


	$("#btnLogin").on("click", controllaLogin)
	$("#btnRecuperaPassword").on("click",recuperaPassword)
	
	// il submit deve partire anche senza click 
	// con il solo tasto INVIO
	$(document).on('keydown', function(event) {	
	   if (event.keyCode == 13)  
		   controllaLogin();
	});
	
	
	function controllaLogin(){
        _username.removeClass("is-invalid");
		_username.prev().removeClass("icona-rossa");  				
        _password.removeClass("is-invalid");
		_password.prev().removeClass("icona-rossa"); 

		_lblErrore.hide();		
		
        if (_username.val() == "") {
            _username.addClass("is-invalid");  
			_username.prev().addClass("icona-rossa");  
        } 
		else if (_password.val() == "") {
            _password.addClass("is-invalid"); 
			_password.prev().addClass("icona-rossa"); 
        }		
		else {
			let request = inviaRichiesta('POST', '/api/login',  
				{ "username": _username.val(),
				  "password": _password.val() 
				}
			);
			request.catch(function(err) {
				// unauthorized
				if (err.status == 401) {  
					_lblErrore.show();
				} 
				else
					errore(err)
			});
			request.then(function(response) {				
				
				window.location.href = "index.html"
			})			
		}
	}
	
	$("#btnGoogle").on("click",function(){
		google.accounts.id.initialize({
			"client_id": oAuthId,
			"callback": function (response) {
				if (response.credential !== "") {
					let token = response.credential
					console.log("token:", token)
					localStorage.setItem("token", token)
					/* window.location.href = "index.html" oppure */
					let request = inviaRichiesta("POST", "/api/googleLogin");
					request.then(function (response) {
						window.location.href = "index.html"
					});
					request.catch(errore);
				}
			}
		})
		google.accounts.id.renderButton(
			document.getElementById("googleDiv"), // qualunque tag DIV della pagina
			{
				"theme": "outline",
				"size": "large",
				"type": "standard",
				"text": "continue_with",
				"shape": "rectangular",
				"logo_alignment": "center"
			}
		);
		google.accounts.id.prompt();
	})


	_lblErrore.children("button").on("click", function(){
		_lblErrore.hide();
	})

	function recuperaPassword(){
		let request=inviaRichiesta("POST","/api/sendNewPassword",{"skipCheckToken":true})
		request.catch(errore)
		request.then((response)=>{
			alert("Mail inviata alla vostra casella di posta")
		})
	}
	
});